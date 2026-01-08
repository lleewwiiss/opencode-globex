import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Setter } from "solid-js"
import { runAgentSession } from "../opencode/session.js"
import { FEATURES_PROMPT } from "../agents/prompts.js"
import { updatePhase, getProjectDir } from "../state/persistence.js"
import type { AppState } from "../app.js"
import { Effect } from "effect"

export interface FeaturesPhaseOptions {
  client: OpencodeClient
  workdir: string
  projectId: string
  projectName: string
  model: string
  variant?: string
  signal: AbortSignal
}

export interface FeaturesPhaseCallbacks {
  onStatusMessage: (message: string) => void
  onComplete: () => void
  onError: (error: Error) => void
}

function buildFeaturesPrompt(projectDir: string): string {
  return `${FEATURES_PROMPT}

## Artifacts to Read
Read the approved plan at: ${projectDir}/plan.md

## Output Location
Write the features.json file to: ${projectDir}/features.json`
}

export async function runFeaturesPhase(
  options: FeaturesPhaseOptions,
  callbacks: FeaturesPhaseCallbacks,
  setState: Setter<AppState>
): Promise<void> {
  const { client, workdir, projectId, model, signal } = options

  if (signal.aborted) {
    return
  }

  const projectDir = getProjectDir(workdir, projectId)
  const prompt = buildFeaturesPrompt(projectDir)

  callbacks.onStatusMessage("Starting feature generation...")

  await runAgentSession({
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
        callbacks.onStatusMessage("Feature generation complete")

        await Effect.runPromise(
          updatePhase(workdir, projectId, "execute")
        )

        callbacks.onComplete()
      },
      onError: (error) => {
        callbacks.onError(error)
      },
    },
  })
}
