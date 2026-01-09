import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Feature } from "../state/schema.js"
import type { ToolEvent } from "../state/types.js"
import { getNextFeature, updateFeature } from "../features/manager.js"
import { checkSignal, clearSignals } from "./signals.js"
import { parseModel, abortSession } from "../opencode/session.js"
import { commitChanges, getCommitsSince, getDiffStatsSince } from "../git.js"
import { readFeatures, writeFeatures, readRejectionInfo } from "../state/features-persistence.js"
import { RALPH_PROMPT, WIGGUM_PROMPT } from "../agents/prompts.js"
import { log } from "../util/log.js"

type AgentName = "ralph" | "wiggum"

interface AgentEventOptions {
  iteration: number
  agent: AgentName
  onToolEvent?: (event: ToolEvent) => void
  onIdleChanged?: (isIdle: boolean, agent: AgentName) => void
}

const MAX_ATTEMPTS = 3
const PAUSE_CHECK_INTERVAL_MS = 1000

export interface RalphLoopContext {
  client: OpencodeClient
  workdir: string
  projectId: string
  model: string
  initialCommitHash: string
}

export interface IterationResult {
  duration: number
  commits: number
  passed: boolean | null
}

export interface RalphLoopCallbacks {
  onIterationStart: (iteration: number, featureId: string) => void
  onIterationComplete: (iteration: number, result: IterationResult) => void
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
  onCommitsUpdated: (commits: number) => void
  onDiffUpdated: (linesAdded: number, linesRemoved: number) => void
  onToolEvent?: (event: ToolEvent) => void
  onIdleChanged?: (isIdle: boolean, agent: AgentName) => void
}

export interface RalphLoopResult {
  success: boolean
  completedFeatures: string[]
  blockedFeatures: string[]
  error?: string
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
      log("ralph", "Paused")
      callbacks.onPaused()
      notifiedPause = true
    }

    await new Promise((resolve) => setTimeout(resolve, PAUSE_CHECK_INTERVAL_MS))
  }

  if (notifiedPause) {
    log("ralph", "Resumed")
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

async function runAgentWithEvents(
  client: OpencodeClient,
  prompt: string,
  model: string,
  eventOptions: AgentEventOptions,
  signal?: AbortSignal
): Promise<boolean> {
  const { iteration, agent, onToolEvent, onIdleChanged } = eventOptions

  log("ralph", "Creating session...", { agent })
  const sessionResult = await client.session.create()
  if (!sessionResult.data?.id) {
    log("ralph", "ERROR: Failed to create session")
    throw new Error("Failed to create session")
  }
  const sessionId = sessionResult.data.id
  const { providerID, modelID } = parseModel(model)
  log("ralph", "Session created", { sessionId, providerID, modelID, agent })

  log("ralph", "Subscribing to events...")
  const events = await client.event.subscribe()

  let promptSent = false
  let success = false
  let receivedFirstToolEvent = false

  onIdleChanged?.(true, agent)

  try {
    for await (const event of events.stream) {
      if (signal?.aborted) {
        log("ralph", "Signal aborted during event loop")
        return false
      }

      // Send prompt when connected
      if (event.type === "server.connected" && !promptSent) {
        promptSent = true
        log("ralph", "server.connected - sending prompt")

        client.session.prompt({
          sessionID: sessionId,
          model: { providerID, modelID },
          parts: [{ type: "text", text: prompt }],
        }).catch((e) => log("ralph", "Prompt error", { error: String(e) }))

        continue
      }

      // Tool events - surface to TUI
      if (event.type === "message.part.updated") {
        const props = event.properties as { part?: { sessionID?: string; type?: string; tool?: string; state?: { status?: string; title?: string; input?: Record<string, unknown>; time?: { end?: number } } } }
        const part = props.part
        if (!part || part.sessionID !== sessionId) continue

        if (part.type === "tool" && part.state?.status === "completed") {
          if (!receivedFirstToolEvent) {
            receivedFirstToolEvent = true
            onIdleChanged?.(false, agent)
          }

          const toolName = part.tool ?? "unknown"
          const title = part.state.title ?? 
            (part.state.input && Object.keys(part.state.input).length > 0
              ? JSON.stringify(part.state.input)
              : toolName)

          onToolEvent?.({
            iteration,
            type: "tool",
            icon: toolName,
            text: ` ${title}`,
            timestamp: part.state.time?.end ?? Date.now(),
          })
        }
      }

      // Session idle - agent finished
      if (event.type === "session.idle" && event.properties.sessionID === sessionId) {
        log("ralph", "session.idle received - agent finished")
        success = true
        break
      }

      // Session error
      if (event.type === "session.error") {
        const props = event.properties
        if (props.sessionID !== sessionId || !props.error) continue

        let errorMessage = String(props.error.name)
        if ("data" in props.error && props.error.data && "message" in props.error.data) {
          errorMessage = String(props.error.data.message)
        }

        log("ralph", "session.error received", { errorMessage })
        throw new Error(errorMessage)
      }
    }
  } finally {
    // Clean up session
    log("ralph", "Cleaning up session", { sessionId })
    await abortSession(client, sessionId).catch((e) => 
      log("ralph", "Session cleanup failed", { error: String(e) })
    )
  }

  if (!success) {
    log("ralph", "Event loop exited unexpectedly")
  }
  return success
}

export async function runRalphLoop(
  ctx: RalphLoopContext,
  callbacks: RalphLoopCallbacks,
  signal?: AbortSignal
): Promise<RalphLoopResult> {
  const { client, workdir, projectId, model, initialCommitHash } = ctx
  const completedFeatures: string[] = []
  const blockedFeatures: string[] = []
  let iteration = 0

  log("ralph", "runRalphLoop started", { projectId, model, initialCommitHash })

  try {
    while (!signal?.aborted) {
      // Check and wait for pause
      await waitWhilePaused(workdir, callbacks, signal)
      if (signal?.aborted) break

      // Load current features
      log("ralph", "Loading features...")
      const features = await readFeatures(workdir, projectId)
      const nextFeature = getNextFeature(features)

      // No more features - we're done
      if (!nextFeature) {
        const completed = features.filter((f) => f.passes).length
        log("ralph", "All features complete", { completed, total: features.length })
        callbacks.onComplete(completed, features.length)
        return {
          success: true,
          completedFeatures,
          blockedFeatures,
        }
      }

      iteration++
      const iterationStartTime = Date.now()
      const commitsAtStart = (await getCommitsSince(workdir, initialCommitHash)).length
      log("ralph", "Starting iteration", { iteration, featureId: nextFeature.id })
      callbacks.onIterationStart(iteration, nextFeature.id)

      // Track attempts for this feature
      const currentAttempts = nextFeature.attempts ?? 0

      // Check if max attempts exceeded
      if (currentAttempts >= MAX_ATTEMPTS) {
        const reason = `Max attempts (${MAX_ATTEMPTS}) exceeded`
        log("ralph", "Feature blocked - max attempts", { featureId: nextFeature.id })
        callbacks.onFeatureBlocked(nextFeature.id, reason)
        blockedFeatures.push(nextFeature.id)

        const updatedFeatures = updateFeature(features, nextFeature.id, {
          blocked: true,
          blockedReason: reason,
        })
        await writeFeatures(workdir, projectId, updatedFeatures)
        continue
      }

      // Get feedback from previous rejection stored in features.json
      let feedback: string | undefined
      if (nextFeature.lastRejectionFeedback && nextFeature.lastRejectionFeedback.length > 0) {
        feedback = nextFeature.lastRejectionFeedback.join("\n")
        log("ralph", "Feeding back rejection reasons from features.json", { featureId: nextFeature.id, feedback })
      }

      // Clear any existing signals before starting
      await clearSignals(workdir)

      // Run Ralph
      log("ralph", "Starting Ralph", { featureId: nextFeature.id })
      callbacks.onRalphStart(nextFeature.id)
      const ralphPrompt = buildRalphPrompt(nextFeature, feedback)

      const ralphSuccess = await runAgentWithEvents(
        client,
        ralphPrompt,
        model,
        {
          iteration,
          agent: "ralph",
          onToolEvent: callbacks.onToolEvent,
          onIdleChanged: callbacks.onIdleChanged,
        },
        signal
      )
      if (!ralphSuccess) {
        if (signal?.aborted) break
        callbacks.onError(new Error(`Ralph session failed for feature ${nextFeature.id}`))
        continue
      }

      callbacks.onRalphComplete(nextFeature.id)

      // Check if Ralph created .globex-done marker
      const doneSignal = await checkSignal(workdir, "done")
      if (!doneSignal) {
        log("ralph", "Ralph did not create .globex-done marker", { featureId: nextFeature.id })
        callbacks.onError(new Error(`Ralph did not create .globex-done marker for ${nextFeature.id}`))
        continue
      }

      // Run Wiggum
      log("ralph", "Starting Wiggum", { featureId: nextFeature.id })
      callbacks.onWiggumStart(nextFeature.id)
      const wiggumPrompt = buildWiggumPrompt(nextFeature)

      const wiggumSuccess = await runAgentWithEvents(
        client,
        wiggumPrompt,
        model,
        {
          iteration,
          agent: "wiggum",
          onToolEvent: callbacks.onToolEvent,
          onIdleChanged: callbacks.onIdleChanged,
        },
        signal
      )
      if (!wiggumSuccess) {
        if (signal?.aborted) break
        callbacks.onError(new Error(`Wiggum session failed for feature ${nextFeature.id}`))
        continue
      }

      // Check Wiggum's decision
      const approved = await checkSignal(workdir, "approved")
      const rejected = await checkSignal(workdir, "rejected")

      log("ralph", "Wiggum decision", { featureId: nextFeature.id, approved, rejected })
      callbacks.onWiggumComplete(nextFeature.id, approved)

      let iterationPassed: boolean | null = null

      if (approved) {
        // Commit changes and update feature as passed (clear rejection feedback)
        log("ralph", "Feature PASSED", { featureId: nextFeature.id, iteration })
        await commitChanges(workdir, `feat(${nextFeature.id}): implement feature`)
        
        // Update commit count and diff stats in TUI
        const commits = await getCommitsSince(workdir, initialCommitHash)
        const diffStats = await getDiffStatsSince(workdir, initialCommitHash)
        callbacks.onCommitsUpdated(commits.length)
        callbacks.onDiffUpdated(diffStats.added, diffStats.removed)
        log("ralph", "Stats updated", { commits: commits.length, added: diffStats.added, removed: diffStats.removed })
        
        const updatedFeatures = updateFeature(features, nextFeature.id, {
          passes: true,
          lastRejectionFeedback: undefined,
        })
        await writeFeatures(workdir, projectId, updatedFeatures)
        completedFeatures.push(nextFeature.id)
        callbacks.onFeatureComplete(nextFeature.id)
        iterationPassed = true
      } else if (rejected) {
        // Increment attempt counter and store rejection feedback in features.json
        const newAttempts = currentAttempts + 1
        const rejection = await readRejectionInfo(workdir)
        const reasons = rejection?.reasons ?? ["Unknown reason"]
        
        log("ralph", "Feature FAILED", { featureId: nextFeature.id, attempt: newAttempts, reasons, iteration })
        const updatedFeatures = updateFeature(features, nextFeature.id, {
          attempts: newAttempts,
          lastRejectionFeedback: reasons,
        })

        await writeFeatures(workdir, projectId, updatedFeatures)
        callbacks.onFeatureRetry(nextFeature.id, newAttempts, reasons.join("; "))
        iterationPassed = false
      } else {
        callbacks.onError(
          new Error(`Wiggum did not create approval/rejection marker for ${nextFeature.id}`)
        )
      }

      // Iteration complete - calculate stats and notify
      const iterationDuration = Date.now() - iterationStartTime
      const commitsAtEnd = (await getCommitsSince(workdir, initialCommitHash)).length
      const iterationCommits = commitsAtEnd - commitsAtStart
      callbacks.onIterationComplete(iteration, {
        duration: iterationDuration,
        commits: iterationCommits,
        passed: iterationPassed,
      })
    }

    log("ralph", "Loop aborted")
    return {
      success: false,
      completedFeatures,
      blockedFeatures,
      error: "Loop aborted",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log("ralph", "ERROR in runRalphLoop", { error: errorMessage })
    callbacks.onError(new Error(errorMessage))
    return {
      success: false,
      completedFeatures,
      blockedFeatures,
      error: errorMessage,
    }
  }
}
