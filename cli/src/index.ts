import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import type { Setter } from "solid-js"
import { startApp, createInitialAppState, type AppState, type AppCallbacks } from "./app.js"
import { getOrCreateOpencodeServer } from "./opencode/server.js"
import { loadState, checkStateExists, createState, saveState, sanitizeProjectId, setActiveProject, getActiveProject, updatePhase, clearActiveProject } from "./state/persistence.js"
import { readFeatures, readFeaturesWithSummary } from "./state/features-persistence.js"
import { loadConfig } from "./config.js"
import { runRalphLoop, type RalphLoopCallbacks } from "./loop/ralph.js"
import { createSignal, removeSignal } from "./loop/signals.js"
import { runResearchPhase } from "./phases/research.js"
import { runResearchInterviewPhase } from "./phases/research-interview.js"
import { runPlanPhase } from "./phases/plan.js"
import { runPlanInterviewPhase } from "./phases/plan-interview.js"
import { runFeaturesPhase } from "./phases/features.js"
import { getProgressStats, getFeatureCategories } from "./features/manager.js"
import { log } from "./util/log.js"
import type { Phase, ToolEvent } from "./state/types.js"
import { Effect } from "effect"

const DEFAULT_MODEL = "anthropic/claude-opus-4-5"
const DEFAULT_VARIANT = "max"

export interface GlobexCliOptions {
  projectId?: string
  model?: string
  signal?: AbortSignal
}

function createLoopCallbacks(
  setState: Setter<AppState>,
  workdir: string,
  projectId: string
): RalphLoopCallbacks {
  return {
    onIterationStart: (iteration, featureId) => {
      const separator: ToolEvent = {
        iteration,
        type: "separator",
        text: `iteration ${iteration}: ${featureId}`,
        timestamp: Date.now(),
      }
      const spinner: ToolEvent = {
        iteration,
        type: "spinner",
        text: "looping...",
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          isIdle: false,
          events: [...prev.execute.events, separator, spinner],
        },
      }))
    },
    onIterationComplete: (iteration) => {
      setState((prev) => {
        const events = prev.execute.events.filter(
          (e) => !(e.type === "spinner" && e.iteration === iteration)
        )
        return {
          ...prev,
          execute: {
            ...prev.execute,
            isIdle: true,
            events,
          },
        }
      })
    },
    onRalphStart: () => {
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          currentAgent: "ralph",
        },
      }))
    },
    onRalphComplete: () => {
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          currentAgent: "idle",
        },
      }))
    },
    onWiggumStart: () => {
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          currentAgent: "wiggum",
        },
      }))
    },
    onWiggumComplete: () => {
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          currentAgent: "idle",
        },
      }))
    },
    onFeatureComplete: () => {
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          featuresComplete: prev.execute.featuresComplete + 1,
        },
      }))
    },
    onFeatureRetry: () => {
      // No-op - spinner continues spinning
    },
    onFeatureBlocked: () => {
      // No-op - will be handled by next iteration
    },
    onPaused: () => {
      setState((prev) => ({
        ...prev,
        execute: { ...prev.execute, paused: true },
      }))
    },
    onResumed: () => {
      setState((prev) => ({
        ...prev,
        execute: { ...prev.execute, paused: false },
      }))
    },
    onComplete: async (completedCount, totalCount) => {
      const event: ToolEvent = {
        iteration: 0,
        type: "separator",
        text: `complete: ${completedCount}/${totalCount} features`,
        timestamp: Date.now(),
      }
      setState((prev) => {
        const events = prev.execute.events.filter((e) => e.type !== "spinner")
        events.push(event)
        return {
          ...prev,
          execute: {
            ...prev.execute,
            isIdle: true,
            currentAgent: "idle",
            events,
          },
        }
      })

      // Update phase to complete and clear active project
      try {
        await Effect.runPromise(updatePhase(workdir, projectId, "complete"))
        await clearActiveProject(workdir)
        log("ralph", "Project marked complete and active project cleared", { projectId })
      } catch (err) {
        log("ralph", "Failed to update phase to complete", { error: String(err) })
      }
    },
    onError: () => {
      // Errors are logged to debug.log - no UI event needed
    },
    onCommitsUpdated: (commits) => {
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          commits,
        },
      }))
    },
  }
}

type PhaseRunner = (ctx: PhaseContext) => Promise<void>

interface PhaseContext {
  workdir: string
  projectId: string
  model: string
  setState: Setter<AppState>
  signal: AbortSignal
  client: ReturnType<typeof createOpencodeClient>
}

const runExecutePhase: PhaseRunner = async (ctx) => {
  const callbacks = createLoopCallbacks(ctx.setState, ctx.workdir, ctx.projectId)

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
    execute: {
      ...prev.execute,
      isIdle: true,
      events: [
        ...prev.execute.events,
        {
          iteration: 0,
          type: "separator",
          text: `waiting: phase requires manual progression`,
          timestamp: Date.now(),
        },
      ],
    },
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

async function transitionToResearch(
  client: ReturnType<typeof createOpencodeClient>,
  setState: Setter<AppState>,
  workdir: string,
  projectId: string,
  projectName: string,
  description: string,
  model: string,
  variant: string,
  signal: AbortSignal
): Promise<{ submitAnswer: (answer: string) => Promise<boolean> }> {
  setState((prev) => ({
    ...prev,
    screen: "background",
    background: {
      phase: "research",
      projectName,
      projectId,
      statusMessages: [],
      startedAt: Date.now(),
    },
  }))

  await runResearchPhase(
    {
      client,
      workdir,
      projectId,
      projectName,
      description,
      model,
      variant,
      signal,
    },
    {
      onStatusMessage: (message) => {
        setState((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            statusMessages: [...prev.background.statusMessages.slice(-4), message],
          },
        }))
      },
      onComplete: () => {
        setState((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            statusMessages: [...prev.background.statusMessages, "Research complete. Moving to interview..."],
          },
        }))
      },
      onError: (error) => {
        setState((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            statusMessages: [...prev.background.statusMessages, `Error: ${error.message}`],
          },
        }))
      },
    },
    setState
  )

  // Chain to interview phase
  const { submitAnswer } = await runResearchInterviewPhase(
    { client, workdir, projectId, projectName, model, signal },
    setState
  )

  return { submitAnswer }
}

async function transitionToPlan(
  client: ReturnType<typeof createOpencodeClient>,
  setState: Setter<AppState>,
  workdir: string,
  projectId: string,
  projectName: string,
  model: string,
  variant: string,
  signal: AbortSignal
): Promise<{ submitAnswer: (answer: string) => Promise<boolean> }> {
  setState((prev) => ({
    ...prev,
    screen: "background",
    background: {
      phase: "plan",
      projectName,
      projectId,
      statusMessages: [],
      startedAt: Date.now(),
    },
  }))

  await runPlanPhase(
    {
      client,
      workdir,
      projectId,
      projectName,
      model,
      variant,
      signal,
    },
    {
      onStatusMessage: (message) => {
        setState((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            statusMessages: [...prev.background.statusMessages.slice(-4), message],
          },
        }))
      },
      onComplete: () => {
        setState((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            statusMessages: [...prev.background.statusMessages, "Plan complete. Moving to interview..."],
          },
        }))
      },
      onError: (error) => {
        setState((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            statusMessages: [...prev.background.statusMessages, `Error: ${error.message}`],
          },
        }))
      },
    },
    setState
  )

  // Chain to plan interview phase
  const { submitAnswer } = await runPlanInterviewPhase(
    { client, workdir, projectId, projectName, model, signal },
    setState
  )

  return { submitAnswer }
}

async function transitionToFeatures(
  client: ReturnType<typeof createOpencodeClient>,
  setState: Setter<AppState>,
  workdir: string,
  projectId: string,
  projectName: string,
  model: string,
  variant: string,
  signal: AbortSignal
): Promise<void> {
  // Show background screen for features generation
  setState((prev) => ({
    ...prev,
    screen: "background",
    background: {
      ...prev.background,
      phase: "features",
      projectName,
      projectId,
      statusMessages: [],
      startedAt: Date.now(),
    },
  }))

  // Run features generation
  await runFeaturesPhase(
    { client, workdir, projectId, projectName, model, variant, signal },
    {
      onStatusMessage: (message) => {
        setState((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            statusMessages: [...prev.background.statusMessages.slice(-4), message],
          },
        }))
      },
      onComplete: async () => {
        // Load features and show confirm screen
        const { features, summary } = await readFeaturesWithSummary(workdir, projectId)
        const categories = getFeatureCategories(features)
        
        setState((prev) => ({
          ...prev,
          screen: "confirm",
          confirm: {
            projectName,
            projectId,
            totalFeatures: features.length,
            featureCategories: categories,
            summary,
          },
        }))
      },
      onError: (error) => {
        setState((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            statusMessages: [...prev.background.statusMessages, `Error: ${error.message}`],
          },
        }))
      },
    },
    setState
  )
}

async function transitionToConfirm(
  setState: Setter<AppState>,
  workdir: string,
  projectId: string,
  projectName: string
): Promise<void> {
  const { features, summary } = await readFeaturesWithSummary(workdir, projectId)
  const categories = getFeatureCategories(features)
  
  setState((prev) => ({
    ...prev,
    screen: "confirm",
    confirm: {
      projectName,
      projectId,
      totalFeatures: features.length,
      featureCategories: categories,
      summary,
    },
  }))
}

async function transitionToExecute(
  client: ReturnType<typeof createOpencodeClient>,
  setState: Setter<AppState>,
  workdir: string,
  projectId: string,
  model: string,
  signal: AbortSignal
): Promise<void> {
  const state = await loadState(workdir, projectId)
  const phase = state.currentPhase
  const features = await readFeatures(workdir, projectId)
  const progress = getProgressStats(features)

  setState((prev) => ({
    ...prev,
    screen: "execute",
    execute: {
      ...prev.execute,
      phase,
      projectName: state.projectName,
      featuresComplete: progress.completed,
      totalFeatures: progress.total,
      startedAt: Date.now(),
    },
  }))

  const ctx: PhaseContext = {
    workdir,
    projectId,
    model,
    setState,
    signal,
    client,
  }

  const runner = PHASE_RUNNERS[phase] ?? runWaitingPhase
  await runner(ctx)
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

  let server: Awaited<ReturnType<typeof getOrCreateOpencodeServer>> | null = null

  try {
    const config = await loadConfig()
    const model = options.model ?? config.model ?? DEFAULT_MODEL

    server = await getOrCreateOpencodeServer({ signal })
    const client = createOpencodeClient({ baseUrl: server.url })

    const initialState = createInitialAppState("init")

    const projectId = options.projectId ?? await getActiveProject(workdir)
    if (projectId) {
      const exists = await checkStateExists(workdir, projectId)
      if (exists) {
        const existingState = await loadState(workdir, projectId)
        initialState.init.activeProject = {
          id: projectId,
          name: existingState.projectName,
          phase: existingState.currentPhase,
        }
      }
    }

    let resolveAction: ((action: { type: "continue"; projectId: string } | { type: "new"; description: string }) => void) | null = null
    const actionPromise = new Promise<{ type: "continue"; projectId: string } | { type: "new"; description: string }>((resolve) => {
      resolveAction = resolve
    })

    // Interview answer handler - set when interview phase starts
    let interviewSubmitAnswer: ((answer: string) => Promise<boolean>) | null = null
    
    // Track current project for phase transitions
    let currentProjectId: string | null = null
    let currentProjectName: string | null = null
    let currentPhase: Phase | null = null

    // Phase transition handler - called when interview completes
    const handlePhaseComplete = async (completedPhase: Phase) => {
      if (!currentProjectId || !currentProjectName) return
      
      if (completedPhase === "research_interview") {
        // research_interview → plan → plan_interview
        const { submitAnswer } = await transitionToPlan(
          client, setState, workdir, currentProjectId, currentProjectName,
          model, DEFAULT_VARIANT, signal
        )
        interviewSubmitAnswer = submitAnswer
        currentPhase = "plan_interview"
      } else if (completedPhase === "plan_interview") {
        // plan_interview → features → confirm
        await transitionToFeatures(
          client, setState, workdir, currentProjectId, currentProjectName,
          model, DEFAULT_VARIANT, signal
        )
        currentPhase = "features"
      }
    }

    const callbacks: AppCallbacks = {
      onQuit: () => abortController.abort(),
      onContinue: (id) => {
        if (resolveAction) resolveAction({ type: "continue", projectId: id })
      },
      onNewProject: (description) => {
        if (resolveAction) resolveAction({ type: "new", description })
      },
      onInterviewAnswer: async (answer) => {
        if (interviewSubmitAnswer) {
          const complete = await interviewSubmitAnswer(answer)
          if (complete && currentPhase) {
            await handlePhaseComplete(currentPhase)
          }
        }
      },
      onConfirmExecute: async () => {
        if (currentProjectId) {
          await transitionToExecute(client, setState, workdir, currentProjectId, model, signal)
          currentPhase = "execute"
        }
      },
      onPauseToggle: async (paused) => {
        log("index", "onPauseToggle called", { paused, workdir })
        if (paused) {
          await createSignal(workdir, "pause")
          log("index", "Pause signal created")
        } else {
          await removeSignal(workdir, "pause")
          log("index", "Pause signal removed")
        }
      },
    }

    const { exitPromise, setState } = await startApp(initialState, callbacks)

    const action = await Promise.race([
      actionPromise,
      exitPromise.then(() => null),
    ])

    if (!action) {
      return
    }

    if (action.type === "continue") {
      const activeProjectId = action.projectId
      const existingState = await loadState(workdir, activeProjectId)
      
      // Set current project context for phase transitions
      currentProjectId = activeProjectId
      currentProjectName = existingState.projectName
      currentPhase = existingState.currentPhase
      
      // Route based on current phase
      if (existingState.currentPhase === "research_interview") {
        const { submitAnswer } = await runResearchInterviewPhase(
          { client, workdir, projectId: activeProjectId, projectName: existingState.projectName, model, signal },
          setState
        )
        interviewSubmitAnswer = submitAnswer
      } else if (existingState.currentPhase === "research") {
        const { submitAnswer } = await transitionToResearch(
          client, setState, workdir, activeProjectId, existingState.projectName, 
          existingState.description, model, DEFAULT_VARIANT, signal
        )
        interviewSubmitAnswer = submitAnswer
        currentPhase = "research_interview"
      } else if (existingState.currentPhase === "plan") {
        const { submitAnswer } = await transitionToPlan(
          client, setState, workdir, activeProjectId, existingState.projectName,
          model, DEFAULT_VARIANT, signal
        )
        interviewSubmitAnswer = submitAnswer
        currentPhase = "plan_interview"
      } else if (existingState.currentPhase === "plan_interview") {
        const { submitAnswer } = await runPlanInterviewPhase(
          { client, workdir, projectId: activeProjectId, projectName: existingState.projectName, model, signal },
          setState
        )
        interviewSubmitAnswer = submitAnswer
      } else if (existingState.currentPhase === "features") {
        // Features already generated, check if features.json exists
        const features = await readFeatures(workdir, activeProjectId)
        if (features.length > 0) {
          // Show confirm screen
          await transitionToConfirm(setState, workdir, activeProjectId, existingState.projectName)
        } else {
          // Need to generate features
          await transitionToFeatures(
            client, setState, workdir, activeProjectId, existingState.projectName,
            model, DEFAULT_VARIANT, signal
          )
        }
      } else if (existingState.currentPhase === "execute") {
        await transitionToExecute(client, setState, workdir, activeProjectId, model, signal)
      } else {
        // init or complete - show execute screen as fallback
        await transitionToExecute(client, setState, workdir, activeProjectId, model, signal)
      }
    } else {
      const projectName = action.description.slice(0, 50)
      const newProjectId = sanitizeProjectId(projectName)
      const newState = createState(projectName, action.description)
      await saveState(workdir, newProjectId, newState)
      await setActiveProject(workdir, newProjectId)

      // Set current project context for phase transitions
      currentProjectId = newProjectId
      currentProjectName = projectName
      currentPhase = "research_interview"

      const { submitAnswer } = await transitionToResearch(client, setState, workdir, newProjectId, projectName, action.description, model, DEFAULT_VARIANT, signal)
      interviewSubmitAnswer = submitAnswer
    }

    await exitPromise
  } finally {
    server?.close()
    await cleanup()
    process.exit(0)
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
