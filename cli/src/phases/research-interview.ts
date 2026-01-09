import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Setter } from "solid-js"
import { abortSession } from "../opencode/session.js"
import { INTERVIEW_PROMPT } from "../agents/prompts.js"
import { updatePhase, getProjectDir } from "../state/persistence.js"
import type { AppState } from "../app.js"
import { Effect } from "effect"
import { log } from "../util/log.js"
import { 
  runInterviewSession, 
  continueInterviewSession,
} from "./interview-engine.js"
import { 
  encodeInterviewAnswers,
  type InterviewAnswersPayload,
  type InterviewRound,
} from "../state/schema.js"

export interface ResearchInterviewOptions {
  client: OpencodeClient
  workdir: string
  projectId: string
  projectName: string
  model: string
  signal: AbortSignal
}

function buildInterviewPrompt(projectDir: string): string {
  return `${INTERVIEW_PROMPT}

## Artifact to Review
Read and analyze the research document at: ${projectDir}/research.md

Start by reading the file, then ask your first round of questions.`
}

export async function runResearchInterviewPhase(
  options: ResearchInterviewOptions,
  setState: Setter<AppState>
): Promise<{ 
  submitAnswer: (payload: InterviewAnswersPayload) => Promise<boolean>
  getCurrentRound: () => InterviewRound | null 
}> {
  const { client, workdir, projectId, projectName, model, signal } = options
  const projectDir = getProjectDir(workdir, projectId)
  const prompt = buildInterviewPrompt(projectDir)

  let round = 1
  let questionsAsked = 0
  let currentSessionId: string | null = null
  let currentRound: InterviewRound | null = null

  log("interview", "Starting research interview phase", { projectId, projectName })

  setState((prev) => ({
    ...prev,
    screen: "interview",
    interview: {
      ...prev.interview,
      phase: "research_interview",
      projectName,
      projectId,
      isWaitingForAgent: true,
      agentMessage: "",
      round: 1,
      questionsAsked: 0,
      startedAt: Date.now(),
      currentRound: null,
    },
  }))

  const firstResult = await runInterviewSession(
    client, 
    prompt, 
    model, 
    signal, 
    "research_interview"
  )
  currentSessionId = firstResult.sessionId
  currentRound = firstResult.roundData
  questionsAsked = firstResult.questionCount

  log("interview", "Got initial response", { 
    sessionId: currentSessionId, 
    questionCount: questionsAsked, 
    complete: firstResult.complete,
    roundTitle: currentRound.roundTitle,
  })

  setState((prev) => ({
    ...prev,
    interview: {
      ...prev.interview,
      isWaitingForAgent: false,
      agentMessage: "",
      questionsAsked,
      currentRound,
    },
  }))

  if (firstResult.complete) {
    if (currentSessionId) {
      log("interview", "Cleaning up session (early complete)", { sessionId: currentSessionId })
      await abortSession(client, currentSessionId).catch((e) => 
        log("interview", "Session cleanup failed", { error: String(e) })
      )
    }
    await Effect.runPromise(updatePhase(workdir, projectId, "plan"))
    return { 
      submitAnswer: async () => true,
      getCurrentRound: () => null,
    }
  }

  const submitAnswer = async (payload: InterviewAnswersPayload): Promise<boolean> => {
    if (!currentSessionId) return false
    
    log("interview", "Submitting user answer", { round, answerCount: payload.answers.length })

    setState((prev) => ({
      ...prev,
      interview: {
        ...prev.interview,
        isWaitingForAgent: true,
        currentRound: null,
      },
    }))

    round++
    const answerJson = encodeInterviewAnswers(payload)
    
    const result = await continueInterviewSession(
      client, 
      currentSessionId, 
      answerJson, 
      model, 
      signal,
      {
        phase: "research_interview",
        round,
        totalQuestionsSoFar: questionsAsked,
      }
    )
    
    questionsAsked += result.questionCount
    currentRound = result.complete ? null : result.roundData

    log("interview", "Got follow-up response", { 
      round, 
      questionCount: result.questionCount, 
      complete: result.complete 
    })

    setState((prev) => ({
      ...prev,
      interview: {
        ...prev.interview,
        isWaitingForAgent: false,
        agentMessage: result.complete ? "Interview complete. Moving to planning phase..." : "",
        round,
        questionsAsked,
        currentRound,
      },
    }))

    if (result.complete) {
      if (currentSessionId) {
        log("interview", "Cleaning up session", { sessionId: currentSessionId })
        await abortSession(client, currentSessionId).catch((e) => 
          log("interview", "Session cleanup failed", { error: String(e) })
        )
      }
      await Effect.runPromise(updatePhase(workdir, projectId, "plan"))
      return true
    }

    return false
  }

  return { 
    submitAnswer,
    getCurrentRound: () => currentRound,
  }
}
