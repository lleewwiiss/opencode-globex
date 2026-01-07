import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import { readState, writeState } from "../state/persistence.js"
import type { InterviewHistory } from "../state/types.js"

const MIN_QUESTIONS = 10
const CONVERGENCE_ROUNDS_TO_STOP = 2

const TIMEBOXES: Record<string, number> = {
  research: 20,
  plan: 30,
}

export const createCheckConvergence = (workdir: string): ToolDefinition => tool({
  description: `Check interview convergence status and decide whether to continue or stop.

Limits by phase: research (20 min), plan (30 min).
Stops when: timebox exceeded, or no new gaps found for 2 rounds after min 10 questions.

Returns JSON: {shouldStop, reason, questionsAsked, minQuestions, elapsedMinutes, timeboxMinutes, convergenceRound}`,
  args: {
    phase: tool.schema.enum(["research", "plan"]),
    questionsThisRound: tool.schema.number(),
    newGapsFound: tool.schema.boolean(),
  },
  async execute(args) {
    const phase = args.phase as "research" | "plan"
    const timeboxMinutes = TIMEBOXES[phase]
    
    const effect = Effect.gen(function* () {
      const state = yield* readState(workdir)
      const defaultHistory: InterviewHistory = {
        questionsAsked: 0,
        convergenceRound: 0,
        noNewGapsStreak: 0,
        duration: "0m",
        startedAt: new Date().toISOString(),
      }
      const history = state.interviewHistory[phase] || defaultHistory
      
      const noNewGapsStreak = args.newGapsFound ? 0 : history.noNewGapsStreak + 1
      const updatedHistory: InterviewHistory = {
        questionsAsked: history.questionsAsked + args.questionsThisRound,
        convergenceRound: history.convergenceRound + 1,
        noNewGapsStreak,
        startedAt: history.startedAt,
        duration: calculateDuration(history.startedAt),
      }
      
      const newState = {
        ...state,
        interviewHistory: { ...state.interviewHistory, [phase]: updatedHistory },
      }
      yield* writeState(workdir, newState)
      
      const elapsedMinutes = parseDuration(updatedHistory.duration)
      
      const converged = updatedHistory.questionsAsked >= MIN_QUESTIONS && 
        noNewGapsStreak >= CONVERGENCE_ROUNDS_TO_STOP
      const timeboxExceeded = elapsedMinutes >= timeboxMinutes
      const shouldStop = converged || timeboxExceeded
      
      const reason = shouldStop
        ? timeboxExceeded
          ? "timebox_exceeded"
          : "converged_no_new_gaps"
        : "continue"
      
      return {
        shouldStop,
        reason,
        questionsAsked: updatedHistory.questionsAsked,
        minQuestions: MIN_QUESTIONS,
        elapsedMinutes,
        timeboxMinutes,
        convergenceRound: updatedHistory.convergenceRound,
        noNewGapsStreak,
      }
    })
    
    const result = await Effect.runPromise(effect)
    return JSON.stringify(result)
  },
})

function calculateDuration(startedAt: string): string {
  const start = new Date(startedAt)
  const now = new Date()
  const minutes = Math.floor((now.getTime() - start.getTime()) / 60000)
  return `${minutes}m`
}

function parseDuration(duration: string): number {
  const match = duration.match(/(\d+)m/)
  return match ? parseInt(match[1], 10) : 0
}
