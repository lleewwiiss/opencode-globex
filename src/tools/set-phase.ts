import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import { readState, writeState } from "../state/persistence.js"
import { PHASE_TRANSITIONS, type Phase } from "../state/types.js"

const VALID_PHASES: Phase[] = [
  "init", "research", "research_interview", "plan", "plan_interview",
  "features", "features_interview", "execute", "complete"
]

export const createSetPhase = (workdir: string): ToolDefinition => tool({
  description: "Transition to a new phase with validation. Enforces allowed transitions (e.g., can't skip from research to execute). Use this instead of directly manipulating state.",
  args: {
    toPhase: tool.schema.string(),
  },
  async execute(args) {
    const toPhase = args.toPhase as Phase
    
    if (!VALID_PHASES.includes(toPhase)) {
      return JSON.stringify({
        success: false,
        error: `Invalid phase: ${toPhase}`,
        validPhases: VALID_PHASES,
      })
    }
    
    const effect = Effect.gen(function* () {
      const state = yield* readState(workdir)
      const currentPhase = state.currentPhase
      const allowedTransitions = PHASE_TRANSITIONS[currentPhase]
      
      if (!allowedTransitions.includes(toPhase)) {
        return {
          success: false,
          error: `Cannot transition from '${currentPhase}' to '${toPhase}'`,
          currentPhase,
          allowedTransitions,
          hint: `From '${currentPhase}', you can only go to: ${allowedTransitions.join(", ")}`,
        }
      }
      
      const newState = { ...state, currentPhase: toPhase }
      yield* writeState(workdir, newState)
      
      return {
        success: true,
        previousPhase: currentPhase,
        currentPhase: toPhase,
        nextAllowedTransitions: PHASE_TRANSITIONS[toPhase],
      }
    })
    
    const result = await Effect.runPromise(effect)
    return JSON.stringify(result)
  },
})
