import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Setter } from "solid-js"
import { runAgentSession, abortSession } from "../opencode/session.js"
import { RESEARCH_PROMPT } from "../agents/prompts.js"
import { updatePhase, getProjectDir } from "../state/persistence.js"
import type { AppState } from "../app.js"
import { Effect } from "effect"
import { log } from "../util/log.js"

export interface ResearchPhaseOptions {
  client: OpencodeClient
  workdir: string
  projectId: string
  projectName: string
  description: string
  model: string
  variant?: string
  signal: AbortSignal
}

export interface ResearchPhaseCallbacks {
  onStatusMessage: (message: string) => void
  onComplete: () => void
  onError: (error: Error) => void
}

function buildResearchPrompt(projectDir: string, description: string): string {
  return `${RESEARCH_PROMPT}

## Project Context
The user wants to: ${description}

Focus your research on areas relevant to implementing this feature.

## Output Location
Write the research.md file to: ${projectDir}/research.md`
}

export async function runResearchPhase(
  options: ResearchPhaseOptions,
  callbacks: ResearchPhaseCallbacks,
  setState: Setter<AppState>
): Promise<void> {
  const { client, workdir, projectId, description, model, signal } = options

  if (signal.aborted) {
    return
  }

  const projectDir = getProjectDir(workdir, projectId)
  const prompt = buildResearchPrompt(projectDir, description)

  callbacks.onStatusMessage("Starting research agent...")

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
        callbacks.onStatusMessage("Research complete")

        await Effect.runPromise(
          updatePhase(workdir, projectId, "research_interview")
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
    log("research", "Cleaning up session", { sessionId })
    await abortSession(client, sessionId).catch((e) => 
      log("research", "Session cleanup failed", { error: String(e) })
    )
  }
}
