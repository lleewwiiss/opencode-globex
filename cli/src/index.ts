import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import type { Setter } from "solid-js"
import { startApp, createInitialAppState, type AppState, type AppCallbacks } from "./app.js"
import { getOrCreateOpencodeServer } from "./opencode/server.js"
import { loadState, checkStateExists, createState, saveState, sanitizeProjectId, setActiveProject, getActiveProject, updatePhase, clearActiveProject, getProjectDir } from "./state/persistence.js"
import * as fs from "node:fs/promises"
import { readFeatures, readFeaturesWithSummary } from "./state/features-persistence.js"
import { loadConfig } from "./config.js"
import { runRalphLoop, type RalphLoopCallbacks, type IterationResult } from "./loop/ralph.js"
import { getHeadHash, getCommitsSince, getDiffStatsSince, createWorktree } from "./git.js"
import { upsertProject, getProject } from "./state/registry.js"
import * as os from "node:os"
import * as path from "node:path"
import { createSignal, removeSignal } from "./loop/signals.js"
import { runResearchPhase } from "./phases/research.js"
import { runResearchInterviewPhase } from "./phases/research-interview.js"
import { runPlanPhase } from "./phases/plan.js"
import { runPlanInterviewPhase } from "./phases/plan-interview.js"
import { runFeaturesPhase } from "./phases/features.js"
import { getProgressStats, getFeatureCategories } from "./features/manager.js"
import { log } from "./util/log.js"
import type { Phase, ToolEvent } from "./state/types.js"
import type { FileReference, InterviewAnswersPayload } from "./state/schema.js"
import { Effect } from "effect"

const DEFAULT_MODEL = "openai/gpt-5.2-codex"
const DEFAULT_VARIANT = "high"

async function readArtifactContent(workdir: string, projectId: string, artifactName: string): Promise<string> {
  const projectDir = getProjectDir(workdir, projectId)
  const artifactPath = `${projectDir}/${artifactName}`
  try {
    return await fs.readFile(artifactPath, "utf-8")
  } catch {
    return `[Could not load ${artifactName}]`
  }
}

/**
 * Returns the worktree path for a project at ~/.globex/workspaces/<projectId>/
 */
export function getWorktreePath(projectId: string): string {
  return path.join(os.homedir(), ".globex", "workspaces", projectId)
}

/**
 * Returns the branch name for a project worktree: globex/<projectId>
 */
export function getWorktreeBranch(projectId: string): string {
  return `globex/${projectId}`
}

export interface GlobexCliOptions {
  projectId?: string
  model?: string
  signal?: AbortSignal
}

function createLoopCallbacks(
  setState: Setter<AppState>,
  workdir: string,
  projectId: string,
  originalWorkdir: string
): RalphLoopCallbacks {
  return {
    onIterationStart: (iteration, featureId) => {
      const separator: ToolEvent = {
        iteration,
        type: "separator",
        text: `iteration ${iteration}: ${featureId}`,
        timestamp: Date.now(),
        commitCount: 0,
      }
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          isIdle: false,
          events: [...prev.execute.events, separator],
        },
      }))
    },
    onIterationComplete: (iteration, result: IterationResult) => {
      setState((prev) => {
        const events = prev.execute.events
          .filter((e) => !(e.type === "spinner" && e.iteration === iteration))
          .map((e) => {
            if (e.type === "separator" && e.iteration === iteration) {
              return {
                ...e,
                duration: result.duration,
                commitCount: result.commits,
                passed: result.passed,
              }
            }
            return e
          })
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
    onRalphStart: (iteration) => {
      const label: ToolEvent = {
        iteration,
        type: "tool",
        icon: "◉",
        text: "Ralph",
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          currentAgent: "ralph",
          isIdle: false,
          events: [...prev.execute.events, label],
        },
      }))
    },
    onRalphComplete: () => {},
    onWiggumStart: (iteration) => {
      const label: ToolEvent = {
        iteration,
        type: "tool",
        icon: "★",
        text: "Wiggum",
        timestamp: Date.now(),
      }
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          currentAgent: "wiggum",
          isIdle: false,
          events: [...prev.execute.events, label],
        },
      }))
    },
    onWiggumComplete: () => {},
    onFeatureComplete: () => {
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          featuresComplete: prev.execute.featuresComplete + 1,
        },
      }))
    },
    onFeatureRetry: () => {},
    onFeatureBlocked: () => {},
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

      // Update phase to complete, update registry, and clear active project
      try {
        await Effect.runPromise(updatePhase(workdir, projectId, "complete"))
        // Update registry with completed phase
        const registryEntry = await getProject(projectId)
        if (registryEntry) {
          await upsertProject(projectId, { ...registryEntry, phase: "complete" })
        }
        // Clear active project from original repo (where active-project file lives)
        await clearActiveProject(originalWorkdir)
        log("ralph", "Project marked complete and active project cleared", { projectId, originalWorkdir })
      } catch (err) {
        log("ralph", "Failed to update phase to complete", { error: String(err) })
      }
    },
    onError: () => {},
    onCommitsUpdated: (commits, iteration) => {
      setState((prev) => {
        const events = prev.execute.events.map((e) => {
          if (e.type === "separator" && e.iteration === iteration) {
            return { ...e, commitCount: commits }
          }
          return e
        })
        return {
          ...prev,
          execute: {
            ...prev.execute,
            commits,
            events,
          },
        }
      })
    },
    onDiffUpdated: (linesAdded, linesRemoved) => {
      setState((prev) => ({
        ...prev,
        execute: {
          ...prev.execute,
          linesAdded,
          linesRemoved,
        },
      }))
    },
    onToolEvent: (event) => {
      // Defer state update to avoid triggering during render cycle
      queueMicrotask(() => {
        setState((prev) => {
          const events = [...prev.execute.events]
          const spinnerIndex = events.findIndex((e) => e.type === "spinner")
          if (spinnerIndex !== -1) {
            events.splice(spinnerIndex, 0, event)
          } else {
            events.push(event)
          }
          return {
            ...prev,
            execute: {
              ...prev.execute,
              events,
            },
          }
        })
      })
    },
    onIdleChanged: (isIdle, agent, iteration) => {
      queueMicrotask(() => {
        setState((prev) => {
          if (isIdle) {
            // Agent finished - remove spinner
            return {
              ...prev,
              execute: {
                ...prev.execute,
                isIdle: true,
                currentAgent: "idle",
                events: prev.execute.events.filter((e) => !(e.type === "spinner" && e.iteration === iteration)),
              },
            }
          } else {
            // Agent started producing output - add spinner
            const spinnerText = agent === "wiggum" 
              ? "Chief Wiggum is keeping him in line..." 
              : "Ralph is working..."
            const spinner: ToolEvent = {
              iteration,
              type: "spinner",
              text: spinnerText,
              timestamp: Date.now(),
            }
            return {
              ...prev,
              execute: {
                ...prev.execute,
                isIdle: false,
                currentAgent: agent,
                events: [...prev.execute.events, spinner],
              },
            }
          }
        })
      })
    },
  }
}

type PhaseRunner = (ctx: PhaseContext) => Promise<void>

interface PhaseContext {
  artifactWorkdir: string
  codeWorkdir: string
  originalWorkdir: string  // Original repo path (process.cwd()) for active-project file
  projectId: string
  model: string
  setState: Setter<AppState>
  signal: AbortSignal
  client: ReturnType<typeof createOpencodeClient>
  initialCommitHash: string
}

const runExecutePhase: PhaseRunner = async (ctx) => {
  const callbacks = createLoopCallbacks(ctx.setState, ctx.artifactWorkdir, ctx.projectId, ctx.originalWorkdir)

  await runRalphLoop(
    {
      client: ctx.client,
      artifactWorkdir: ctx.artifactWorkdir,
      codeWorkdir: ctx.codeWorkdir,
      projectId: ctx.projectId,
      model: ctx.model,
      initialCommitHash: ctx.initialCommitHash,
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
  refs: FileReference[],
  model: string,
  variant: string,
  signal: AbortSignal
): Promise<{ submitAnswer: (payload: InterviewAnswersPayload) => Promise<boolean> }> {
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
      refs,
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
): Promise<{ submitAnswer: (payload: InterviewAnswersPayload) => Promise<boolean> }> {
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

  // After plan phase, go directly to plan_interview (matching research flow)
  // The interview will transition to review when complete
  return await runPlanInterviewPhase(
    { client, workdir, projectId, projectName, model, signal },
    setState
  )
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
  serverUrl: string,
  setState: Setter<AppState>,
  workdir: string,
  projectId: string,
  model: string,
  signal: AbortSignal,
  originalWorkdir?: string
): Promise<void> {
  const state = await loadState(workdir, projectId)
  const phase = state.currentPhase
  const features = await readFeatures(workdir, projectId)
  const progress = getProgressStats(features)

  // Determine the effective working directory for code operations
  // Artifacts are in workdir, code runs in codeWorkdir (may be worktree)
  const codeWorkdir = state.workspace?.worktreePath ?? workdir
  if (state.workspace?.worktreePath) {
    log("index", "Using worktree for execution", { projectId, worktreePath: codeWorkdir })
  }

  // Create client with worktree directory so OpenCode agents run in the right place
  const client = createOpencodeClient({ baseUrl: serverUrl, directory: codeWorkdir })
  log("index", "Created OpenCode client with directory", { directory: codeWorkdir })

  // Get or create initial commit hash for tracking cumulative stats
  let initialCommitHash = state.initialCommitHash
  if (!initialCommitHash) {
    initialCommitHash = await getHeadHash(codeWorkdir)
    await saveState(workdir, projectId, { ...state, initialCommitHash })
    log("index", "Saved initial commit hash", { projectId, initialCommitHash })
  }

  // Load cumulative git stats from initial commit
  const commits = await getCommitsSince(codeWorkdir, initialCommitHash)
  const diffStats = await getDiffStatsSince(codeWorkdir, initialCommitHash)
  log("index", "Loaded git stats on resume", {
    commits: commits.length,
    linesAdded: diffStats.added,
    linesRemoved: diffStats.removed,
  })

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
      commits: commits.length,
      linesAdded: diffStats.added,
      linesRemoved: diffStats.removed,
    },
  }))

  const ctx: PhaseContext = {
    artifactWorkdir: workdir,
    codeWorkdir,
    originalWorkdir: originalWorkdir ?? workdir,
    projectId,
    model,
    setState,
    signal,
    client,
    initialCommitHash,
  }

  const runner = PHASE_RUNNERS[phase] ?? runWaitingPhase
  await runner(ctx)
}

export async function main(options: GlobexCliOptions = {}): Promise<void> {
  const workdir = process.cwd()
  const abortController = new AbortController()
  const signal = options.signal ?? abortController.signal

  const keepaliveInterval = setInterval(() => {}, 60000)
  let server: Awaited<ReturnType<typeof getOrCreateOpencodeServer>> | null = null

  let shutdownResolve: (() => void) | null = null
  const shutdownPromise = new Promise<void>((resolve) => {
    shutdownResolve = resolve
  })
  let shutdownRequested = false
  let requestAppExit = () => {}

  async function cleanup() {
    clearInterval(keepaliveInterval)
    abortController.abort()
  }

  const requestShutdown = async (code: number) => {
    if (shutdownRequested) return
    shutdownRequested = true
    process.exitCode = code
    shutdownResolve?.()
    requestAppExit()
    await cleanup()
    server?.close()
  }

  process.on("SIGINT", () => {
    void requestShutdown(0)
  })

  process.on("SIGTERM", () => {
    void requestShutdown(0)
  })

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
        // Don't offer to continue completed projects
        if (existingState.currentPhase !== "complete") {
          // Get registry entry for worktree path
          const registryEntry = await getProject(projectId)
          initialState.init.activeProject = {
            id: projectId,
            name: existingState.projectName,
            phase: existingState.currentPhase,
            worktreePath: registryEntry?.worktreePath,
          }
        }
      }
    }

    type InitAction = 
      | { type: "continue"; projectId: string }
      | { type: "new"; description: string; refs: FileReference[]; useWorktree: boolean }
    let resolveAction: ((action: InitAction) => void) | null = null
    const actionPromise = new Promise<InitAction>((resolve) => {
      resolveAction = resolve
    })

    // Interview answer handler - set when interview phase starts
    let interviewSubmitAnswer: ((payload: InterviewAnswersPayload) => Promise<boolean>) | null = null
    
    // Track current project for phase transitions
    let currentProjectId: string | null = null
    let currentProjectName: string | null = null
    let currentPhase: Phase | null = null
    let currentWorkdir: string = workdir

    // Transition to review screen after interview completes
    const transitionToReview = async (completedPhase: Phase) => {
      if (!currentProjectId || !currentProjectName) return
      
      const artifactName = completedPhase === "research_interview" ? "research.md" 
        : (completedPhase === "plan" || completedPhase === "plan_interview") ? "plan.md" 
        : "research.md"
      const artifactContent = await readArtifactContent(currentWorkdir, currentProjectId, artifactName)
      
      // Save reviewPending to state so we can resume at review screen
      const state = await loadState(currentWorkdir, currentProjectId)
      await saveState(currentWorkdir, currentProjectId, { ...state, reviewPending: true })
      
      setState((prev) => ({
        ...prev,
        screen: "review",
        review: {
          phase: completedPhase,
          projectName: currentProjectName!,
          projectId: currentProjectId!,
          artifactName,
          artifactContent,
          chatHistory: [],
          isWaitingForAgent: false,
          startedAt: Date.now(),
        },
      }))
    }

    // Phase transition handler - called when review is confirmed
    const handleReviewConfirm = async () => {
      if (!currentProjectId || !currentProjectName || !currentPhase) return
      
      // Clear reviewPending flag
      const state = await loadState(currentWorkdir, currentProjectId)
      await saveState(currentWorkdir, currentProjectId, { ...state, reviewPending: false })
      
      if (currentPhase === "research_interview") {
        // research_interview review confirmed → plan phase (which includes plan_interview)
        const { submitAnswer } = await transitionToPlan(
          client, setState, currentWorkdir, currentProjectId, currentProjectName,
          model, DEFAULT_VARIANT, signal
        )
        interviewSubmitAnswer = submitAnswer
        currentPhase = "plan_interview"
      } else if (currentPhase === "plan_interview") {
        // plan_interview review confirmed → features → confirm
        await transitionToFeatures(
          client, setState, currentWorkdir, currentProjectId, currentProjectName,
          model, DEFAULT_VARIANT, signal
        )
        currentPhase = "features"
      }
    }

    // Handle feedback in review screen - simple back-and-forth
    let currentArtifactName: string | null = null
    
    const handleReviewFeedback = async (feedback: string) => {
      if (!currentProjectId || !currentProjectName) {
        log("index", "Cannot handle feedback - missing context", { 
          currentProjectId, currentProjectName
        })
        return
      }
      
      // Add user message to chat history
      setState((prev) => {
        currentArtifactName = prev.review.artifactName
        return {
          ...prev,
          review: {
            ...prev.review,
            chatHistory: [...prev.review.chatHistory, { role: "user" as const, content: feedback }],
            isWaitingForAgent: true,
          },
        }
      })
      
      setTimeout(async () => {
        const artifactContent = currentArtifactName 
          ? await readArtifactContent(currentWorkdir, currentProjectId!, currentArtifactName)
          : ""
        
        setState((prev) => ({
          ...prev,
          review: {
            ...prev.review,
            artifactContent,
            chatHistory: [...prev.review.chatHistory, { 
              role: "agent" as const, 
              content: "Feedback noted. Please review the artifact above and confirm when ready to proceed, or provide more feedback." 
            }],
            isWaitingForAgent: false,
          },
        }))
      }, 500)
    }

    const callbacks: AppCallbacks = {
      onQuit: () => {
        log("index", "Quit requested")
        // Don't call process.exit here - let the exitPromise resolve
        // and the finally block handle cleanup gracefully
      },
      onContinue: (id) => {
        if (resolveAction) resolveAction({ type: "continue", projectId: id })
      },
      onNewProject: (description, refs, useWorktree) => {
        if (resolveAction) resolveAction({ type: "new", description, refs, useWorktree })
      },
      onInterviewAnswer: async (payload) => {
        if (interviewSubmitAnswer) {
          const complete = await interviewSubmitAnswer(payload)
          if (complete && currentPhase) {
            await transitionToReview(currentPhase)
          }
        }
      },
      onReviewConfirm: async () => {
        await handleReviewConfirm()
      },
      onReviewFeedback: async (feedback) => {
        await handleReviewFeedback(feedback)
      },
      onConfirmExecute: async () => {
        if (currentProjectId) {
          await transitionToExecute(server!.url, setState, currentWorkdir, currentProjectId, model, signal, workdir)
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

    const { exitPromise, setState, exit } = await startApp(initialState, callbacks, workdir)
    requestAppExit = exit

    const action = await Promise.race([
      actionPromise,
      exitPromise.then(() => null),
      shutdownPromise.then(() => null),
    ])

    if (!action) {
      return
    }

    if (action.type === "continue") {
      const activeProjectId = action.projectId
      const existingState = await loadState(workdir, activeProjectId)
      
      // Determine effective workdir - use worktree if configured
      const effectiveWorkdir = existingState.workspace?.worktreePath ?? workdir
      if (existingState.workspace?.worktreePath) {
        log("index", "Resuming project in worktree", { activeProjectId, worktreePath: effectiveWorkdir })
      }
      
      // Set current project context for phase transitions
      currentProjectId = activeProjectId
      currentProjectName = existingState.projectName
      currentPhase = existingState.currentPhase
      currentWorkdir = effectiveWorkdir
      
      // Route based on current phase
      if (existingState.currentPhase === "research_interview") {
        if (existingState.reviewPending) {
          // Interview was completed, show review screen
          await transitionToReview("research_interview")
        } else {
          const { submitAnswer } = await runResearchInterviewPhase(
            { client, workdir: effectiveWorkdir, projectId: activeProjectId, projectName: existingState.projectName, model, signal },
            setState
          )
          interviewSubmitAnswer = submitAnswer
        }
      } else if (existingState.currentPhase === "research") {
        const { submitAnswer } = await transitionToResearch(
          client, setState, effectiveWorkdir, activeProjectId, existingState.projectName, 
          existingState.description, [], model, DEFAULT_VARIANT, signal
        )
        interviewSubmitAnswer = submitAnswer
        currentPhase = "research_interview"
      } else if (existingState.currentPhase === "plan") {
        // Run plan background phase → plan_interview
        const { submitAnswer } = await transitionToPlan(
          client, setState, effectiveWorkdir, activeProjectId, existingState.projectName,
          model, DEFAULT_VARIANT, signal
        )
        interviewSubmitAnswer = submitAnswer
        currentPhase = "plan_interview"
      } else if (existingState.currentPhase === "plan_interview") {
        if (existingState.reviewPending) {
          // Interview was completed, show review screen
          await transitionToReview("plan_interview")
        } else {
          const { submitAnswer } = await runPlanInterviewPhase(
            { client, workdir: effectiveWorkdir, projectId: activeProjectId, projectName: existingState.projectName, model, signal },
            setState
          )
          interviewSubmitAnswer = submitAnswer
        }
      } else if (existingState.currentPhase === "features") {
        // Features already generated, check if features.json exists
        const features = await readFeatures(effectiveWorkdir, activeProjectId)
        if (features.length > 0) {
          // Show confirm screen
          await transitionToConfirm(setState, effectiveWorkdir, activeProjectId, existingState.projectName)
        } else {
          // Need to generate features
          await transitionToFeatures(
            client, setState, effectiveWorkdir, activeProjectId, existingState.projectName,
            model, DEFAULT_VARIANT, signal
          )
        }
      } else if (existingState.currentPhase === "execute") {
        await transitionToExecute(server.url, setState, effectiveWorkdir, activeProjectId, model, signal, workdir)
      } else if (existingState.currentPhase === "complete") {
        // Complete projects should not be continued - clear and return to init
        log("index", "Cannot continue completed project", { projectId: activeProjectId })
        await clearActiveProject(workdir)
        return
      } else {
        // init phase - restart from research
        const { submitAnswer } = await transitionToResearch(
          client, setState, effectiveWorkdir, activeProjectId, existingState.projectName,
          existingState.description, [], model, DEFAULT_VARIANT, signal
        )
        interviewSubmitAnswer = submitAnswer
        currentPhase = "research_interview"
      }
    } else {
      const projectName = action.description.slice(0, 50)
      const newProjectId = sanitizeProjectId(projectName)
      
      // Determine effective workdir based on worktree choice
      let effectiveWorkdir = workdir
      if (action.useWorktree) {
        const worktreePath = getWorktreePath(newProjectId)
        const branchName = getWorktreeBranch(newProjectId)
        
        try {
          await createWorktree(workdir, worktreePath, branchName)
          log("index", "Created worktree for new project", { newProjectId, worktreePath, branchName })
          effectiveWorkdir = worktreePath
          
          // Update registry with worktree info
          await upsertProject(newProjectId, {
            name: projectName,
            repoPath: workdir,
            phase: "research",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            worktreePath,
            branchName,
          })
        } catch (err) {
          log("index", "Failed to create worktree, falling back to current dir", {
            newProjectId,
            error: String(err),
          })
        }
      }
      
      const newState = createState(projectName, action.description)
      // Store workspace info in state
      if (action.useWorktree && effectiveWorkdir !== workdir) {
        newState.workspace = {
          type: "worktree",
          worktreePath: effectiveWorkdir,
          branchName: getWorktreeBranch(newProjectId),
          createdAt: new Date().toISOString(),
        }
      } else {
        newState.workspace = { type: "current" }
      }
      
      await saveState(effectiveWorkdir, newProjectId, newState)
      await setActiveProject(effectiveWorkdir, newProjectId)

      // Set current project context for phase transitions
      currentProjectId = newProjectId
      currentProjectName = projectName
      currentPhase = "research_interview"
      currentWorkdir = effectiveWorkdir

      const { submitAnswer } = await transitionToResearch(client, setState, effectiveWorkdir, newProjectId, projectName, action.description, action.refs, model, DEFAULT_VARIANT, signal)
      interviewSubmitAnswer = submitAnswer
    }

    await Promise.race([exitPromise, shutdownPromise])
  } finally {
    server?.close()
    await cleanup()
    // Small delay to let Bun/OpenTUI finish cleanup before exit
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
