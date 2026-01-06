import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import { readState, writeState } from "../state/persistence.js"
import type { InterviewHistory } from "../state/types.js"

const LIMITS: Record<string, { maxQuestions: number; timeboxMinutes: number }> = {
  research: { maxQuestions: 25, timeboxMinutes: 20 },
  plan: { maxQuestions: 30, timeboxMinutes: 30 },
  features: { maxQuestions: 20, timeboxMinutes: 15 },
}

export const createCheckConvergence = (workdir: string): ToolDefinition => tool({
  description: "Check interview convergence status - whether to continue or stop interviewing",
  args: {
    phase: tool.schema.enum(["research", "plan", "features"]),
    questionsThisRound: tool.schema.number(),
    newGapsFound: tool.schema.boolean(),
  },
  async execute(args) {
    const phase = args.phase as "research" | "plan" | "features"
    const limits = LIMITS[phase]
    
    const effect = Effect.gen(function* () {
      const state = yield* readState(workdir)
      const history = state.interviewHistory[phase] || {
        questionsAsked: 0,
        convergenceRound: 0,
        duration: "0m",
        startedAt: new Date().toISOString(),
      }
      
      const updatedHistory: InterviewHistory = {
        questionsAsked: history.questionsAsked + args.questionsThisRound,
        convergenceRound: history.convergenceRound + 1,
        startedAt: history.startedAt,
        duration: calculateDuration(history.startedAt),
      }
      
      const newState = {
        ...state,
        interviewHistory: { ...state.interviewHistory, [phase]: updatedHistory },
      }
      yield* writeState(workdir, newState)
      
      return { history: updatedHistory, limits }
    })
    
    const { history, limits: phaseLimits } = await Effect.runPromise(effect)
    
    const elapsedMinutes = parseDuration(history.duration)
    const shouldStop = 
      history.questionsAsked >= phaseLimits.maxQuestions ||
      elapsedMinutes >= phaseLimits.timeboxMinutes ||
      (!args.newGapsFound && history.convergenceRound >= 2)
    
    const reason = shouldStop
      ? history.questionsAsked >= phaseLimits.maxQuestions
        ? "max_questions_reached"
        : elapsedMinutes >= phaseLimits.timeboxMinutes
          ? "timebox_exceeded"
          : "converged_no_new_gaps"
      : "continue"
    
    return JSON.stringify({
      shouldStop,
      reason,
      questionsAsked: history.questionsAsked,
      maxQuestions: phaseLimits.maxQuestions,
      elapsedMinutes,
      timeboxMinutes: phaseLimits.timeboxMinutes,
      convergenceRound: history.convergenceRound,
    })
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
