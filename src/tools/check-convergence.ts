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
  description: `Check interview convergence status and decide whether to continue or stop.

Limits by phase: research (25 questions, 20 min), plan (30 questions, 30 min), features (20 questions, 15 min).
Stops when: max questions reached, timebox exceeded, or no new gaps found for 2 rounds.

Returns JSON: {shouldStop, reason, questionsAsked, maxQuestions, elapsedMinutes, timeboxMinutes, convergenceRound}`,
  args: {
    phase: tool.schema.enum(["research", "plan", "features"]),
    questionsThisRound: tool.schema.number(),
    newGapsFound: tool.schema.boolean(),
  },
  async execute(args) {
    const phase = args.phase as "research" | "plan" | "features"
    const phaseLimits = LIMITS[phase]
    
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
      
      const elapsedMinutes = parseDuration(updatedHistory.duration)
      const shouldStop = 
        updatedHistory.questionsAsked >= phaseLimits.maxQuestions ||
        elapsedMinutes >= phaseLimits.timeboxMinutes ||
        (!args.newGapsFound && updatedHistory.convergenceRound >= 2)
      
      const reason = shouldStop
        ? updatedHistory.questionsAsked >= phaseLimits.maxQuestions
          ? "max_questions_reached"
          : elapsedMinutes >= phaseLimits.timeboxMinutes
            ? "timebox_exceeded"
            : "converged_no_new_gaps"
        : "continue"
      
      return {
        shouldStop,
        reason,
        questionsAsked: updatedHistory.questionsAsked,
        maxQuestions: phaseLimits.maxQuestions,
        elapsedMinutes,
        timeboxMinutes: phaseLimits.timeboxMinutes,
        convergenceRound: updatedHistory.convergenceRound,
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
