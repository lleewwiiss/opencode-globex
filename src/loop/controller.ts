import type { LoopState, LoopStatus } from "../state/types.js"
import { loadLoopStateAsync, saveLoopStateAsync, getActiveProject, getProjectDir } from "../state/persistence.js"
import { commitChanges } from "./git.js"
import { Effect } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"

export interface LoopContext {
  workdir: string
  client: any // SDK v2 client
  showToast: (message: string, variant?: "info" | "success" | "warning" | "error", title?: string) => Promise<void>
  log: (message: string, level?: "info" | "warn" | "error" | "debug") => Promise<void>
  model: string
}

export interface LoopController {
  start(maxIterations?: number): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  status(): Promise<LoopStatus>
}

export function createLoopController(ctx: LoopContext): LoopController {
  return {
    async start(maxIterations = 50): Promise<void> {
      const state = await getInitialState(ctx.workdir)
      const updatedState: LoopState = {
        ...state,
        status: "running",
        totalIterations: maxIterations,
        startedAt: new Date().toISOString(),
        pausedAt: undefined
      }
      await saveLoopStateAsync(ctx.workdir, updatedState)
    },

    async pause(): Promise<void> {
      const state = await loadLoopStateAsync(ctx.workdir)
      if (state && state.status === "running") {
        const updatedState: LoopState = {
          ...state,
          status: "paused",
          pausedAt: new Date().toISOString()
        }
        await saveLoopStateAsync(ctx.workdir, updatedState)
      }
    },

    async resume(): Promise<void> {
      const state = await loadLoopStateAsync(ctx.workdir)
      if (state && state.status === "paused") {
        const updatedState: LoopState = {
          ...state,
          status: "running",
          pausedAt: undefined
        }
        await saveLoopStateAsync(ctx.workdir, updatedState)
      }
    },

    async status(): Promise<LoopStatus> {
      const state = await loadLoopStateAsync(ctx.workdir)
      return state?.status ?? "idle"
    }
  }
}

async function getInitialState(workdir: string): Promise<LoopState> {
  const existing = await loadLoopStateAsync(workdir)
  if (existing) {
    return existing
  }
  
  return {
    status: "idle",
    currentFeatureId: undefined,
    lastCommitHash: undefined,
    iteration: 0,
    totalIterations: undefined,
    startedAt: undefined,
    pausedAt: undefined,
    ralphSessionId: undefined,
    wiggumSessionId: undefined,
    lastSignal: undefined,
    completedFeatures: [],
    blockedFeatures: []
  }
}

export async function spawnSession(
  ctx: LoopContext,
  agent: string,
  prompt: string
): Promise<string> {
  const response = await ctx.client.session.create({
    body: {
      agent,
      initialPrompt: prompt,
      model: ctx.model
    }
  })

  if (!response.data?.sessionID) {
    throw new Error("Failed to create session")
  }

  return response.data.sessionID
}

export async function waitForSessionIdle(
  ctx: LoopContext,
  sessionId: string,
  timeoutMs = 300000
): Promise<boolean> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await ctx.client.session.status({ sessionID: sessionId })
      if (response.data?.status === "idle") {
        return true
      }
    } catch (error) {
      await ctx.log(`Session status check failed: ${error}`, "warn")
    }
    
    // Poll every 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  return false
}

export async function runIteration(ctx: LoopContext, state: LoopState): Promise<LoopState> {
  const { workdir } = ctx
  await ctx.log(`Starting iteration ${state.iteration + 1}`, "info")
  
  // Check for pause signal
  const pauseFile = path.join(workdir, ".globex-pause")
  try {
    await fs.access(pauseFile)
    await ctx.showToast("Loop paused", "info", "Globex")
    return { ...state, status: "paused", pausedAt: new Date().toISOString() }
  } catch {
    // No pause file, continue
  }
  
  // Get next feature via external call
  const projectId = await Effect.runPromise(getActiveProject(workdir))
  const featuresPath = path.join(getProjectDir(workdir, projectId), "features.json")
  
  const featuresContent = await fs.readFile(featuresPath, "utf-8")
  const featuresData = JSON.parse(featuresContent)
  
  const completedIds = new Set(featuresData.features.filter((f: any) => f.passes).map((f: any) => f.id))
  const eligible = featuresData.features
    .filter((f: any) => !f.passes)
    .filter((f: any) => !f.blocked)
    .filter((f: any) => f.dependencies.every((dep: string) => completedIds.has(dep)))
    .sort((a: any, b: any) => a.priority - b.priority)
  
  if (eligible.length === 0) {
    const incomplete = featuresData.features.filter((f: any) => !f.passes)
    if (incomplete.length === 0) {
      await ctx.showToast("All features complete!", "success", "Globex")
      return { ...state, status: "complete" }
    } else {
      await ctx.showToast("No eligible features - all blocked", "error", "Globex")
      return { ...state, status: "complete" }
    }
  }
  
  const feature = eligible[0]
  await ctx.showToast(`Starting feature: ${feature.id}`, "info", "Globex")
  
  // Spawn Ralph session
  const ralphPrompt = `Implement ONE feature. Output <ralph>DONE:${feature.id}</ralph> when ready for validation. Do NOT commit. Do NOT call globex_update_feature with passes:true.

Feature: ${feature.id}
Description: ${feature.description}
Acceptance Criteria: ${feature.acceptanceCriteria?.join(", ") || "None"}
Files to modify: ${feature.filesTouched?.join(", ") || "Any"}
Priority: ${feature.priority}
Previous attempts: ${feature.attempts || 0}
${feature.feedback ? `Feedback from previous attempts: ${feature.feedback}` : ""}`

  const ralphSessionId = await spawnSession(ctx, "globex-ralph", ralphPrompt)
  await ctx.log(`Ralph session started: ${ralphSessionId}`, "info")
  
  const ralphCompleted = await waitForSessionIdle(ctx, ralphSessionId)
  if (!ralphCompleted) {
    await ctx.log("Ralph session timeout", "error")
    throw new Error("Ralph session timeout")
  }
  
  // Check for Ralph signal files
  const doneFile = path.join(workdir, ".globex-done")
  try {
    await fs.access(doneFile)
    await fs.unlink(doneFile) // Clean up signal file
  } catch {
    // No done signal - assume blocked
    const updateData = { ...featuresData }
    const featureIndex = updateData.features.findIndex((f: any) => f.id === feature.id)
    if (featureIndex !== -1) {
      updateData.features[featureIndex].blocked = true
      updateData.features[featureIndex].blockedReason = "Ralph did not complete"
      await fs.writeFile(featuresPath, JSON.stringify(updateData, null, 2))
    }
    
    await ctx.showToast(`Feature ${feature.id} blocked by Ralph`, "warning", "Globex")
    return {
      ...state,
      iteration: state.iteration + 1,
      currentFeatureId: feature.id,
      lastSignal: "ralph-blocked"
    }
  }
  
  // Spawn Wiggum for validation
  const wiggumPrompt = `Validate feature implementation: ${feature.id}
  
Description: ${feature.description}
Acceptance Criteria: ${feature.acceptanceCriteria?.join(", ") || "None"}

Review the working tree changes and determine if the feature passes all criteria. Output one of:
- <wiggum>APPROVED:${feature.id}</wiggum> if implementation is correct
- <wiggum>REJECTED:${feature.id}:reason</wiggum> if implementation needs work`

  const wiggumSessionId = await spawnSession(ctx, "globex-wiggum", wiggumPrompt)
  await ctx.log(`Wiggum session started: ${wiggumSessionId}`, "info")
  
  const wiggumCompleted = await waitForSessionIdle(ctx, wiggumSessionId)
  if (!wiggumCompleted) {
    await ctx.log("Wiggum session timeout", "error")
    throw new Error("Wiggum session timeout")
  }
  
  // Check for Wiggum verdict files
  const approvedFile = path.join(workdir, ".globex-approved")
  const rejectedFile = path.join(workdir, ".globex-rejected")
  
  let approved = false
  let rejectionReason = ""
  
  try {
    await fs.access(approvedFile)
    approved = true
    await fs.unlink(approvedFile) // Clean up signal file
  } catch {
    try {
      const rejectionContent = await fs.readFile(rejectedFile, "utf-8")
      rejectionReason = rejectionContent.trim()
      await fs.unlink(rejectedFile) // Clean up signal file
    } catch {
      rejectionReason = "No verdict from Wiggum"
    }
  }
  
  if (approved) {
    // Commit changes and mark feature complete
    const commitMessage = `feat(${feature.id}): ${feature.description}`
    const commitHash = commitChanges(workdir, commitMessage) || undefined
    
    const updateData = { ...featuresData }
    const featureIndex = updateData.features.findIndex((f: any) => f.id === feature.id)
    if (featureIndex !== -1) {
      updateData.features[featureIndex].passes = true
      updateData.features[featureIndex].completedAt = new Date().toISOString()
      updateData.features[featureIndex].attempts = (updateData.features[featureIndex].attempts || 0) + 1
      await fs.writeFile(featuresPath, JSON.stringify(updateData, null, 2))
    }
    
    await ctx.showToast(`Feature ${feature.id} completed and committed`, "success", "Globex")
    
    return {
      ...state,
      iteration: state.iteration + 1,
      currentFeatureId: feature.id,
      lastCommitHash: commitHash,
      lastSignal: "approved",
      completedFeatures: [...state.completedFeatures, feature.id]
    }
  } else {
    // Increment attempts, may auto-block at 5
    const updateData = { ...featuresData }
    const featureIndex = updateData.features.findIndex((f: any) => f.id === feature.id)
    if (featureIndex !== -1) {
      const newAttempts = (updateData.features[featureIndex].attempts || 0) + 1
      updateData.features[featureIndex].attempts = newAttempts
      updateData.features[featureIndex].feedback = rejectionReason
      
      if (newAttempts >= 5) {
        updateData.features[featureIndex].blocked = true
        updateData.features[featureIndex].blockedReason = `Auto-blocked: exceeded 5 attempts`
      }
      
      await fs.writeFile(featuresPath, JSON.stringify(updateData, null, 2))
      
      if (newAttempts >= 5) {
        await ctx.showToast(`Feature ${feature.id} auto-blocked after 5 attempts`, "error", "Globex")
        return {
          ...state,
          iteration: state.iteration + 1,
          currentFeatureId: feature.id,
          lastSignal: "rejected-blocked",
          blockedFeatures: [...state.blockedFeatures, feature.id]
        }
      } else {
        await ctx.showToast(`Feature ${feature.id} rejected, attempt ${newAttempts}`, "warning", "Globex")
        return {
          ...state,
          iteration: state.iteration + 1,
          currentFeatureId: feature.id,
          lastSignal: "rejected"
        }
      }
    }
    
    return {
      ...state,
      iteration: state.iteration + 1,
      currentFeatureId: feature.id,
      lastSignal: "rejected"
    }
  }
}