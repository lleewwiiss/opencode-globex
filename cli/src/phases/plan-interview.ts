import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Setter } from "solid-js"
import { abortSession } from "../opencode/session.js"
import { PLAN_INTERVIEW_PROMPT } from "../agents/prompts.js"
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

export async function runPlanInterviewPhase(
  options: PlanInterviewOptions,
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
      currentRound: null,
    },
  }))

  const firstResult = await runInterviewSession(
    client, 
    prompt, 
    model, 
    signal, 
    "plan_interview"
  )
  currentSessionId = firstResult.sessionId
  currentRound = firstResult.roundData
  questionsAsked = firstResult.questionCount

  log("plan-interview", "Got initial response", { 
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
      log("plan-interview", "Cleaning up session (early complete)", { sessionId: currentSessionId })
      await abortSession(client, currentSessionId).catch((e) => 
        log("plan-interview", "Session cleanup failed", { error: String(e) })
      )
    }
    await Effect.runPromise(updatePhase(workdir, projectId, "features"))
    return { 
      submitAnswer: async () => true,
      getCurrentRound: () => null,
    }
  }

  const submitAnswer = async (payload: InterviewAnswersPayload): Promise<boolean> => {
    if (!currentSessionId) return false
    
    log("plan-interview", "Submitting user answer", { round, answerCount: payload.answers.length })

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
        phase: "plan_interview",
        round,
        totalQuestionsSoFar: questionsAsked,
      }
    )
    
    questionsAsked += result.questionCount
    currentRound = result.complete ? null : result.roundData

    log("plan-interview", "Got follow-up response", { 
      round, 
      questionCount: result.questionCount, 
      complete: result.complete 
    })

    setState((prev) => ({
      ...prev,
      interview: {
        ...prev.interview,
        isWaitingForAgent: false,
        agentMessage: result.complete ? "Interview complete. Moving to feature generation..." : "",
        round,
        questionsAsked,
        currentRound,
      },
    }))

    if (result.complete) {
      if (currentSessionId) {
        log("plan-interview", "Cleaning up session", { sessionId: currentSessionId })
        await abortSession(client, currentSessionId).catch((e) => 
          log("plan-interview", "Session cleanup failed", { error: String(e) })
        )
      }
      await Effect.runPromise(updatePhase(workdir, projectId, "features"))
      return true
    }

    return false
  }

  return { 
    submitAnswer,
    getCurrentRound: () => currentRound,
  }
}
