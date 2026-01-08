import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import type { Setter } from "solid-js"
import { startApp, type TUIState } from "./app.js"
import { getOrCreateOpencodeServer } from "./opencode/server.js"
import { loadState, checkStateExists, getProjectDir } from "./state/persistence.js"
import { loadConfig } from "./config.js"
import { runRalphLoop, type RalphLoopCallbacks } from "./loop/ralph.js"
import { getProgressStats } from "./features/manager.js"
import type { Phase, ToolEvent } from "./state/types.js"
import type { Feature } from "../../src/state/schema.js"
import { Effect } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"

const DEFAULT_MODEL = "anthropic/claude-sonnet-4"

export interface GlobexCliOptions {
  projectId?: string
  model?: string
  signal?: AbortSignal
}

async function readFeaturesJson(workdir: string, projectId: string): Promise<Feature[]> {
  const effect = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = `${getProjectDir(workdir, projectId)}/features.json`
    const exists = yield* fs.exists(path)
    if (!exists) return []
    const content = yield* fs.readFileString(path)
    const parsed = JSON.parse(content) as { features: Feature[] }
    return parsed.features
  }).pipe(Effect.provide(NodeFileSystem.layer))

  return Effect.runPromise(effect).catch(() => [])
}

function createInitialTUIState(phase: Phase, projectName: string): TUIState {
  return {
    phase,
    projectName,
    featuresComplete: 0,
    totalFeatures: 0,
    startedAt: Date.now(),
    eta: undefined,
    events: [],
    isIdle: true,
    paused: false,
    commits: 0,
    linesAdded: 0,
    linesRemoved: 0,
  }
}

function createLoopCallbacks(setState: Setter<TUIState>): RalphLoopCallbacks {
  return {
    onIterationStart: (iteration, featureId) => {
      const event: ToolEvent = {
        iteration,
        type: "separator",
        text: `iteration ${iteration}: ${featureId}`,
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        isIdle: false,
        events: [...prev.events, event],
      }))
    },
    onRalphStart: (featureId) => {
      const event: ToolEvent = {
        iteration: 0,
        type: "tool",
        icon: "task",
        text: `Ralph: ${featureId}`,
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        events: [...prev.events, event],
      }))
    },
    onRalphComplete: () => {
      // Wiggum starts next
    },
    onWiggumStart: (featureId) => {
      const event: ToolEvent = {
        iteration: 0,
        type: "tool",
        icon: "task",
        text: `Wiggum: ${featureId}`,
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        events: [...prev.events, event],
      }))
    },
    onWiggumComplete: (featureId, approved) => {
      const event: ToolEvent = {
        iteration: 0,
        type: "tool",
        icon: approved ? "write" : "read",
        text: `${featureId}: ${approved ? "approved" : "rejected"}`,
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        events: [...prev.events, event],
      }))
    },
    onFeatureComplete: (featureId) => {
      setState((prev) => ({
        ...prev,
        featuresComplete: prev.featuresComplete + 1,
        events: [
          ...prev.events,
          {
            iteration: 0,
            type: "tool",
            icon: "write",
            text: `completed: ${featureId}`,
            timestamp: Date.now(),
          },
        ],
      }))
    },
    onFeatureRetry: (featureId, attempt, reason) => {
      const event: ToolEvent = {
        iteration: 0,
        type: "tool",
        icon: "read",
        text: `retry ${attempt}: ${featureId} - ${reason}`,
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        events: [...prev.events, event],
      }))
    },
    onFeatureBlocked: (featureId, reason) => {
      const event: ToolEvent = {
        iteration: 0,
        type: "tool",
        icon: "read",
        text: `blocked: ${featureId} - ${reason}`,
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        events: [...prev.events, event],
      }))
    },
    onPaused: () => {
      setState((prev) => ({ ...prev, paused: true }))
    },
    onResumed: () => {
      setState((prev) => ({ ...prev, paused: false }))
    },
    onComplete: (completedCount, totalCount) => {
      const event: ToolEvent = {
        iteration: 0,
        type: "separator",
        text: `complete: ${completedCount}/${totalCount} features`,
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        isIdle: true,
        events: [...prev.events, event],
      }))
    },
    onError: (error) => {
      const event: ToolEvent = {
        iteration: 0,
        type: "tool",
        icon: "read",
        text: `error: ${error.message}`,
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        events: [...prev.events, event],
      }))
    },
  }
}

type PhaseRunner = (ctx: PhaseContext) => Promise<void>

interface PhaseContext {
  workdir: string
  projectId: string
  model: string
  setState: Setter<TUIState>
  signal: AbortSignal
  client: ReturnType<typeof createOpencodeClient>
}

const runExecutePhase: PhaseRunner = async (ctx) => {
  const callbacks = createLoopCallbacks(ctx.setState)

  await runRalphLoop(
    {
      client: ctx.client,
      workdir: ctx.workdir,
      projectId: ctx.projectId,
      model: ctx.model,
    },
    callbacks,
    ctx.signal
  )
}

const runWaitingPhase: PhaseRunner = async (ctx) => {
  ctx.setState((prev) => ({
    ...prev,
    isIdle: true,
    events: [
      ...prev.events,
      {
        iteration: 0,
        type: "separator",
        text: `waiting: phase requires manual progression`,
        timestamp: Date.now(),
      },
    ],
  }))
}

const PHASE_RUNNERS: Partial<Record<Phase, PhaseRunner>> = {
  execute: runExecutePhase,
  init: runWaitingPhase,
  research: runWaitingPhase,
  research_interview: runWaitingPhase,
  plan: runWaitingPhase,
  plan_interview: runWaitingPhase,
  features: runWaitingPhase,
  complete: runWaitingPhase,
}

export async function main(options: GlobexCliOptions = {}): Promise<void> {
  const workdir = process.cwd()
  const abortController = new AbortController()
  const signal = options.signal ?? abortController.signal

  const keepaliveInterval = setInterval(() => {}, 60000)

  async function cleanup() {
    clearInterval(keepaliveInterval)
    abortController.abort()
  }

  process.on("SIGINT", async () => {
    await cleanup()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    await cleanup()
    process.exit(0)
  })

  try {
    const config = await loadConfig()
    const model = options.model ?? config.model ?? DEFAULT_MODEL

    const projectId = options.projectId ?? config.defaultProject
    if (!projectId) {
      console.error("No project specified. Run 'globex init' first or specify --project")
      process.exit(1)
    }

    const exists = await checkStateExists(workdir, projectId)
    if (!exists) {
      console.error(`Project '${projectId}' not found. Run 'globex init' first.`)
      process.exit(1)
    }

    const state = await loadState(workdir, projectId)
    const phase = state.currentPhase

    const features = await readFeaturesJson(workdir, projectId)
    const progress = getProgressStats(features)

    const initialTUIState = createInitialTUIState(phase, state.projectName)
    initialTUIState.featuresComplete = progress.completed
    initialTUIState.totalFeatures = progress.total

    const { exitPromise, setState } = await startApp(
      initialTUIState,
      () => abortController.abort()
    )

    const server = await getOrCreateOpencodeServer({ signal })
    const client = createOpencodeClient({ baseUrl: server.url })

    const ctx: PhaseContext = {
      workdir,
      projectId,
      model,
      setState,
      signal,
      client,
    }

    const runner = PHASE_RUNNERS[phase] ?? runWaitingPhase

    runner(ctx).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setState((prev) => ({
        ...prev,
        events: [
          ...prev.events,
          {
            iteration: 0,
            type: "tool",
            icon: "read",
            text: `fatal: ${errorMessage}`,
            timestamp: Date.now(),
          },
        ],
      }))
    })

    await exitPromise
    server.close()
  } finally {
    await cleanup()
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
