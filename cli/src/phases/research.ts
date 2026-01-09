import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Setter } from "solid-js"
import { runAgentSession, abortSession } from "../opencode/session.js"
import { RESEARCH_PROMPT } from "../agents/prompts.js"
import { updatePhase, getProjectDir } from "../state/persistence.js"
import type { AppState } from "../app.js"
import type { FileReference } from "../state/schema.js"
import { Effect } from "effect"
import { log } from "../util/log.js"
import * as fs from "node:fs"
import * as path from "node:path"

export interface ResearchPhaseOptions {
  client: OpencodeClient
  workdir: string
  projectId: string
  projectName: string
  description: string
  refs?: FileReference[]
  model: string
  variant?: string
  signal: AbortSignal
}

export interface ResearchPhaseCallbacks {
  onStatusMessage: (message: string) => void
  onComplete: () => void
  onError: (error: Error) => void
}

function readFileContent(workdir: string, ref: FileReference): string | null {
  try {
    const filePath = path.isAbsolute(ref.path) ? ref.path : path.join(workdir, ref.path)
    const content = fs.readFileSync(filePath, "utf-8")
    
    if (ref.lineStart !== undefined) {
      const lines = content.split("\n")
      const start = Math.max(0, ref.lineStart - 1)
      const end = ref.lineEnd !== undefined ? ref.lineEnd : ref.lineStart
      return lines.slice(start, end).join("\n")
    }
    
    return content
  } catch {
    return null
  }
}

function buildReferencedFilesSection(workdir: string, refs: FileReference[]): string {
  if (!refs || refs.length === 0) return ""
  
  const fileContents: string[] = []
  
  for (const ref of refs) {
    const content = readFileContent(workdir, ref)
    if (content) {
      const lineRange = ref.lineStart 
        ? ref.lineEnd 
          ? `#L${ref.lineStart}-L${ref.lineEnd}`
          : `#L${ref.lineStart}`
        : ""
      fileContents.push(`### ${ref.path}${lineRange}\n\`\`\`\n${content}\n\`\`\``)
    }
  }
  
  if (fileContents.length === 0) return ""
  
  return `\n\n## Referenced Files\nThe user has attached these files for context:\n\n${fileContents.join("\n\n")}`
}

function buildResearchPrompt(projectDir: string, description: string, workdir: string, refs?: FileReference[]): string {
  const refsSection = buildReferencedFilesSection(workdir, refs ?? [])
  
  return `${RESEARCH_PROMPT}

## Project Context
The user wants to: ${description}${refsSection}

Focus your research on areas relevant to implementing this feature.

## Output Location
Write the research.md file to: ${projectDir}/research.md`
}

export async function runResearchPhase(
  options: ResearchPhaseOptions,
  callbacks: ResearchPhaseCallbacks,
  setState: Setter<AppState>
): Promise<void> {
  const { client, workdir, projectId, description, refs, model, signal } = options

  if (signal.aborted) {
    return
  }

  const projectDir = getProjectDir(workdir, projectId)
  const prompt = buildResearchPrompt(projectDir, description, workdir, refs)

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
