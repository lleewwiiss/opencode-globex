import type { LoopState, LoopStatus } from "../state/types.js"
import { loadLoopStateAsync, saveLoopStateAsync } from "../state/persistence.js"

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