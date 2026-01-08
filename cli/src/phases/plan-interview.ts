import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Setter } from "solid-js"
import { parseModel } from "../opencode/session.js"
import { PLAN_INTERVIEW_PROMPT } from "../agents/prompts.js"
import { updatePhase, getProjectDir } from "../state/persistence.js"
import type { AppState } from "../app.js"
import { Effect } from "effect"
import { log } from "../util/log.js"

export interface PlanInterviewOptions {
  client: OpencodeClient
  workdir: string
  projectId: string
  projectName: string
  model: string
  signal: AbortSignal
}

function buildInterviewPrompt(projectDir: string): string {
  return `${PLAN_INTERVIEW_PROMPT}

## Artifacts to Review
Read and analyze:
- Research document: ${projectDir}/research.md
- Plan document: ${projectDir}/plan.md
- Risk assessment: ${projectDir}/plan-risks.json

Start by reading the files, then ask your first round of questions about the plan.`
}

/**
 * Run the plan interview phase.
 * Spawns a new session, reads plan.md, and does Q&A with user.
 * Returns submitAnswer function for TUI to call when user responds.
 */
export async function runPlanInterviewPhase(
  options: PlanInterviewOptions,
  setState: Setter<AppState>
): Promise<{ submitAnswer: (answer: string) => Promise<boolean> }> {
  const { client, workdir, projectId, projectName, model, signal } = options
  const projectDir = getProjectDir(workdir, projectId)
  const prompt = buildInterviewPrompt(projectDir)

  let round = 1
  let questionsAsked = 0
  let currentSessionId: string | null = null
  let agentText = ""

  log("plan-interview", "Starting plan interview phase", { projectId, projectName })

  setState((prev) => ({
    ...prev,
    screen: "interview",
    interview: {
      ...prev.interview,
      phase: "plan_interview",
      projectName,
      projectId,
      isWaitingForAgent: true,
      agentMessage: "",
      round: 1,
      questionsAsked: 0,
      startedAt: Date.now(),
    },
  }))

  // Run initial session and wait for first response
  const firstResult = await runInterviewSession(client, prompt, model, signal)
  currentSessionId = firstResult.sessionId
  agentText = firstResult.text
  questionsAsked = firstResult.questionCount

  log("plan-interview", "Got initial response", { 
    sessionId: currentSessionId, 
    questionCount: questionsAsked, 
    complete: firstResult.complete,
    textLength: agentText.length
  })

  setState((prev) => ({
    ...prev,
    interview: {
      ...prev.interview,
      isWaitingForAgent: false,
      agentMessage: agentText,
      questionsAsked,
    },
  }))

  if (firstResult.complete) {
    await Effect.runPromise(updatePhase(workdir, projectId, "features"))
    return { submitAnswer: async () => true }
  }

  // Return function for TUI to submit answers
  const submitAnswer = async (answer: string): Promise<boolean> => {
    if (!currentSessionId) return false
    
    log("plan-interview", "Submitting user answer", { round })

    setState((prev) => ({
      ...prev,
      interview: {
        ...prev.interview,
        isWaitingForAgent: true,
        agentMessage: "",
      },
    }))

    round++  // Increment before call so parseResult knows the round
    const result = await continueInterviewSession(client, currentSessionId, answer, model, signal, round)
    questionsAsked += result.questionCount

    log("plan-interview", "Got follow-up response", { round, questionCount: result.questionCount, complete: result.complete })

    setState((prev) => ({
      ...prev,
      interview: {
        ...prev.interview,
        isWaitingForAgent: false,
        agentMessage: result.complete ? "Interview complete. Moving to feature generation..." : result.text,
        round,
        questionsAsked,
      },
    }))

    if (result.complete) {
      await Effect.runPromise(updatePhase(workdir, projectId, "features"))
      return true
    }

    return false
  }

  return { submitAnswer }
}

interface InterviewResult {
  sessionId: string
  text: string
  questionCount: number
  complete: boolean
}

interface AgentResult {
  text: string
  questionCount: number
  complete: boolean
}

const MAX_INTERVIEW_ROUNDS = 5

function parseResult(text: string, round: number): AgentResult {
  // Match numbered questions like "1.", "2." at start of line, or bold numbered like "**1."
  const questionMatches = text.match(/^(?:\*\*)?\d+\./gm)
  const questionCount = questionMatches?.length ?? 0
  
  // Complete if: explicit marker or max rounds reached (deterministic)
  const hasExplicitMarker = text.includes("INTERVIEW_COMPLETE")
  const maxRoundsReached = round >= MAX_INTERVIEW_ROUNDS
  const complete = hasExplicitMarker || maxRoundsReached
  
  log("plan-interview", "parseResult", { 
    textPreview: text.substring(0, 200),
    matches: questionMatches,
    round,
    complete,
    reason: hasExplicitMarker ? "explicit" : maxRoundsReached ? "max-rounds" : "none"
  })
  return {
    text,
    questionCount,
    complete,
  }
}

async function runInterviewSession(
  client: OpencodeClient,
  prompt: string,
  model: string,
  signal: AbortSignal
): Promise<InterviewResult> {
  const { providerID, modelID } = parseModel(model)
  
  const createResult = await client.session.create()
  if (!createResult.data?.id) {
    throw new Error("Failed to create session")
  }
  const sessionId = createResult.data.id
  
  log("plan-interview", "Session created", { sessionId })
  
  const events = await client.event.subscribe()
  let promptSent = false
  let text = ""
  
  for await (const event of events.stream) {
    if (signal.aborted) break
    
    if (event.type === "server.connected" && !promptSent) {
      promptSent = true
      client.session.prompt({
        sessionID: sessionId,
        model: { providerID, modelID },
        parts: [{ type: "text", text: prompt }],
      }).catch((e) => log("plan-interview", "Prompt error", { error: String(e) }))
      continue
    }
    
    if (event.type === "message.part.updated") {
      const part = event.properties.part
      if (part.sessionID !== sessionId) continue
      if (part.type === "text" && "text" in part) {
        text = (part as { text?: string }).text || ""
      }
    }
    
    if (event.type === "session.idle" && event.properties.sessionID === sessionId) {
      break
    }
    
    if (event.type === "session.error" && event.properties.sessionID === sessionId) {
      throw new Error("Session error")
    }
  }
  
  return { sessionId, ...parseResult(text, 1) }
}

async function continueInterviewSession(
  client: OpencodeClient,
  sessionId: string,
  answer: string,
  model: string,
  signal: AbortSignal,
  round: number
): Promise<AgentResult> {
  const { providerID, modelID } = parseModel(model)
  
  const events = await client.event.subscribe()
  let text = ""
  
  client.session.prompt({
    sessionID: sessionId,
    model: { providerID, modelID },
    parts: [{ type: "text", text: answer }],
  }).catch((e) => log("plan-interview", "Answer prompt error", { error: String(e) }))
  
  for await (const event of events.stream) {
    if (signal.aborted) break
    
    if (event.type === "message.part.updated") {
      const part = event.properties.part
      if (part.sessionID !== sessionId) continue
      if (part.type === "text" && "text" in part) {
        text = (part as { text?: string }).text || ""
      }
    }
    
    if (event.type === "session.idle" && event.properties.sessionID === sessionId) {
      break
    }
    
    if (event.type === "session.error" && event.properties.sessionID === sessionId) {
      throw new Error("Session error")
    }
  }
  
  return parseResult(text, round)
}
