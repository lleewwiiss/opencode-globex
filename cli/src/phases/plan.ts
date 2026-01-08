import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Setter } from "solid-js"
import { runAgentSession, abortSession } from "../opencode/session.js"
import { PLAN_PROMPT } from "../agents/prompts.js"
import { updatePhase, getProjectDir, loadState } from "../state/persistence.js"
import type { AppState } from "../app.js"
import { Effect } from "effect"
import { log } from "../util/log.js"

export interface PlanPhaseOptions {
  client: OpencodeClient
  workdir: string
  projectId: string
  projectName: string
  model: string
  variant?: string
  signal: AbortSignal
}

export interface PlanPhaseCallbacks {
  onStatusMessage: (message: string) => void
  onComplete: () => void
  onError: (error: Error) => void
}

function buildPlanPrompt(projectDir: string, description: string): string {
  return `${PLAN_PROMPT}

## Project Context
The user wants to: ${description}

## Research Document
Read the research analysis at: ${projectDir}/research.md

## Output Location
Write the plan.md file to: ${projectDir}/plan.md
Write the plan-risks.json file to: ${projectDir}/plan-risks.json`
}

export async function runPlanPhase(
  options: PlanPhaseOptions,
  callbacks: PlanPhaseCallbacks,
  setState: Setter<AppState>
): Promise<void> {
  const { client, workdir, projectId, model, signal } = options

  if (signal.aborted) {
    return
  }

  const projectDir = getProjectDir(workdir, projectId)
  const state = await loadState(workdir, projectId)
  const prompt = buildPlanPrompt(projectDir, state.description)

  callbacks.onStatusMessage("Starting planning agent...")

  const sessionId = await runAgentSession({
    client,
    prompt,
    model,
    variant: options.variant,
    signal,
    callbacks: {
      onToolEvent: (event) => {
        const shortTitle = event.title.length > 50
          ? event.title.slice(0, 47) + "..."
          : event.title

        setState((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            statusMessages: [
              ...prev.background.statusMessages.slice(-4),
              `${event.toolName}: ${shortTitle}`,
            ],
          },
        }))
      },
      onComplete: async () => {
        callbacks.onStatusMessage("Plan complete")

        await Effect.runPromise(
          updatePhase(workdir, projectId, "plan_interview")
        )

        callbacks.onComplete()
      },
      onError: (error) => {
        callbacks.onError(error)
      },
    },
  })

  // Clean up session
  if (sessionId) {
    log("plan", "Cleaning up session", { sessionId })
    await abortSession(client, sessionId).catch((e) => 
      log("plan", "Session cleanup failed", { error: String(e) })
    )
  }
}
