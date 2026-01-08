import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Feature } from "../state/schema.js"
import { getNextFeature, updateFeature } from "../features/manager.js"
import { checkSignal, clearSignals } from "./signals.js"
import { spawnAgentSession, waitForSessionIdle } from "../opencode/session.js"
import { getProjectDir } from "../state/persistence.js"
import { commitChanges } from "../git.js"
import { RALPH_PROMPT, WIGGUM_PROMPT } from "../agents/prompts.js"
import { Effect } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"

const MAX_ATTEMPTS = 3
const SESSION_TIMEOUT_MS = 600_000 // 10 minutes
const PAUSE_CHECK_INTERVAL_MS = 1000

export interface RalphLoopContext {
  client: OpencodeClient
  workdir: string
  projectId: string
  model: string
}

export interface RalphLoopCallbacks {
  onIterationStart: (iteration: number, featureId: string) => void
  onRalphStart: (featureId: string) => void
  onRalphComplete: (featureId: string) => void
  onWiggumStart: (featureId: string) => void
  onWiggumComplete: (featureId: string, approved: boolean) => void
  onFeatureComplete: (featureId: string) => void
  onFeatureRetry: (featureId: string, attempt: number, reason: string) => void
  onFeatureBlocked: (featureId: string, reason: string) => void
  onPaused: () => void
  onResumed: () => void
  onComplete: (completedCount: number, totalCount: number) => void
  onError: (error: Error) => void
}

export interface RalphLoopResult {
  success: boolean
  completedFeatures: string[]
  blockedFeatures: string[]
  error?: string
}

interface RejectionInfo {
  featureId: string
  reasons: string[]
}

async function readFeaturesJson(workdir: string, projectId: string): Promise<Feature[]> {
  const effect = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = `${getProjectDir(workdir, projectId)}/features.json`
    const content = yield* fs.readFileString(path)
    const parsed = JSON.parse(content) as { features: Feature[] }
    return parsed.features
  }).pipe(Effect.provide(NodeFileSystem.layer))

  return Effect.runPromise(effect)
}

async function writeFeaturesJson(
  workdir: string,
  projectId: string,
  features: Feature[]
): Promise<void> {
  const effect = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = `${getProjectDir(workdir, projectId)}/features.json`
    const content = JSON.stringify({ features }, null, 2)
    yield* fs.writeFileString(path, content)
  }).pipe(Effect.provide(NodeFileSystem.layer))

  return Effect.runPromise(effect)
}

async function readRejectionInfo(workdir: string): Promise<RejectionInfo | null> {
  const effect = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = `${workdir}/.globex-rejected`
    const exists = yield* fs.exists(path)
    if (!exists) return null
    const content = yield* fs.readFileString(path)
    return JSON.parse(content) as RejectionInfo
  }).pipe(Effect.provide(NodeFileSystem.layer))

  return Effect.runPromise(effect).catch(() => null)
}

async function checkPaused(workdir: string): Promise<boolean> {
  return checkSignal(workdir, "pause")
}

async function waitWhilePaused(
  workdir: string,
  callbacks: RalphLoopCallbacks,
  signal?: AbortSignal
): Promise<void> {
  let notifiedPause = false

  while (await checkPaused(workdir)) {
    if (signal?.aborted) return

    if (!notifiedPause) {
      callbacks.onPaused()
      notifiedPause = true
    }

    await new Promise((resolve) => setTimeout(resolve, PAUSE_CHECK_INTERVAL_MS))
  }

  if (notifiedPause) {
    callbacks.onResumed()
  }
}

function buildRalphPrompt(feature: Feature, feedback?: string): string {
  let prompt = RALPH_PROMPT
  prompt += `\n\n## Current Feature\n`
  prompt += `ID: ${feature.id}\n`
  prompt += `Description: ${feature.description}\n`

  if (feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0) {
    prompt += `\nAcceptance Criteria:\n`
    for (const criterion of feature.acceptanceCriteria) {
      prompt += `- ${criterion}\n`
    }
  }

  if (feature.filesTouched && feature.filesTouched.length > 0) {
    prompt += `\nFiles to Touch:\n`
    for (const file of feature.filesTouched) {
      prompt += `- ${file}\n`
    }
  }

  if (feature.patternsToFollow && feature.patternsToFollow.length > 0) {
    prompt += `\nPatterns to Follow:\n`
    for (const pattern of feature.patternsToFollow) {
      prompt += `- ${pattern.file}:${pattern.lines} - ${pattern.pattern}\n`
    }
  }

  if (feedback) {
    prompt += `\n## Previous Attempt Feedback\n`
    prompt += `Your previous implementation was rejected. Address these issues:\n${feedback}\n`
  }

  return prompt
}

function buildWiggumPrompt(feature: Feature): string {
  let prompt = WIGGUM_PROMPT
  prompt += `\n\n## Current Feature to Validate\n`
  prompt += `ID: ${feature.id}\n`
  prompt += `Description: ${feature.description}\n`

  if (feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0) {
    prompt += `\nAcceptance Criteria:\n`
    for (const criterion of feature.acceptanceCriteria) {
      prompt += `- ${criterion}\n`
    }
  }

  return prompt
}

export async function runRalphLoop(
  ctx: RalphLoopContext,
  callbacks: RalphLoopCallbacks,
  signal?: AbortSignal
): Promise<RalphLoopResult> {
  const { client, workdir, projectId, model } = ctx
  const completedFeatures: string[] = []
  const blockedFeatures: string[] = []
  let iteration = 0

  try {
    while (!signal?.aborted) {
      // Check and wait for pause
      await waitWhilePaused(workdir, callbacks, signal)
      if (signal?.aborted) break

      // Load current features
      const features = await readFeaturesJson(workdir, projectId)
      const nextFeature = getNextFeature(features)

      // No more features - we're done
      if (!nextFeature) {
        const completed = features.filter((f) => f.passes).length
        callbacks.onComplete(completed, features.length)
        return {
          success: true,
          completedFeatures,
          blockedFeatures,
        }
      }

      iteration++
      callbacks.onIterationStart(iteration, nextFeature.id)

      // Track attempts for this feature
      const currentAttempts = nextFeature.attempts ?? 0

      // Check if max attempts exceeded
      if (currentAttempts >= MAX_ATTEMPTS) {
        const reason = `Max attempts (${MAX_ATTEMPTS}) exceeded`
        callbacks.onFeatureBlocked(nextFeature.id, reason)
        blockedFeatures.push(nextFeature.id)

        // Mark feature as blocked
        const updatedFeatures = updateFeature(features, nextFeature.id, {
          blocked: true,
          blockedReason: reason,
        })
        await writeFeaturesJson(workdir, projectId, updatedFeatures)
        continue
      }

      // Clear any existing signals before starting
      await clearSignals(workdir)

      // Get feedback from previous rejection if any
      let feedback: string | undefined
      const rejectionInfo = await readRejectionInfo(workdir)
      if (rejectionInfo && rejectionInfo.featureId === nextFeature.id) {
        feedback = rejectionInfo.reasons.join("\n")
      }

      // Spawn Ralph
      callbacks.onRalphStart(nextFeature.id)
      const ralphPrompt = buildRalphPrompt(nextFeature, feedback)
      const ralphSessionId = await spawnAgentSession(
        client,
        "globex-ralph",
        ralphPrompt,
        model
      )

      // Wait for Ralph to complete
      const ralphIdle = await waitForSessionIdle(client, ralphSessionId, SESSION_TIMEOUT_MS)
      if (!ralphIdle) {
        callbacks.onError(new Error(`Ralph session timed out for feature ${nextFeature.id}`))
        continue
      }

      if (signal?.aborted) break

      callbacks.onRalphComplete(nextFeature.id)

      // Check if Ralph created .globex-done marker
      const doneSignal = await checkSignal(workdir, "done")
      if (!doneSignal) {
        callbacks.onError(new Error(`Ralph did not create .globex-done marker for ${nextFeature.id}`))
        continue
      }

      // Spawn Wiggum
      callbacks.onWiggumStart(nextFeature.id)
      const wiggumPrompt = buildWiggumPrompt(nextFeature)
      const wiggumSessionId = await spawnAgentSession(
        client,
        "globex-wiggum",
        wiggumPrompt,
        model
      )

      // Wait for Wiggum to complete
      const wiggumIdle = await waitForSessionIdle(client, wiggumSessionId, SESSION_TIMEOUT_MS)
      if (!wiggumIdle) {
        callbacks.onError(new Error(`Wiggum session timed out for feature ${nextFeature.id}`))
        continue
      }

      if (signal?.aborted) break

      // Check Wiggum's decision
      const approved = await checkSignal(workdir, "approved")
      const rejected = await checkSignal(workdir, "rejected")

      callbacks.onWiggumComplete(nextFeature.id, approved)

      if (approved) {
        // Commit changes and update feature as passed
        await commitChanges(workdir, `feat(${nextFeature.id}): implement feature`)
        const updatedFeatures = updateFeature(features, nextFeature.id, {
          passes: true,
        })
        await writeFeaturesJson(workdir, projectId, updatedFeatures)
        completedFeatures.push(nextFeature.id)
        callbacks.onFeatureComplete(nextFeature.id)
      } else if (rejected) {
        // Increment attempt counter
        const newAttempts = currentAttempts + 1
        const updatedFeatures = updateFeature(features, nextFeature.id, {
          attempts: newAttempts,
        })

        // Read rejection reasons for callback
        const rejection = await readRejectionInfo(workdir)
        const reasonText = rejection?.reasons.join("; ") ?? "Unknown reason"

        await writeFeaturesJson(workdir, projectId, updatedFeatures)
        callbacks.onFeatureRetry(nextFeature.id, newAttempts, reasonText)
      } else {
        callbacks.onError(
          new Error(`Wiggum did not create approval/rejection marker for ${nextFeature.id}`)
        )
      }
    }

    // Aborted
    return {
      success: false,
      completedFeatures,
      blockedFeatures,
      error: "Loop aborted",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    callbacks.onError(new Error(errorMessage))
    return {
      success: false,
      completedFeatures,
      blockedFeatures,
      error: errorMessage,
    }
  }
}
