import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import { recordApproval, updatePhase, readState } from "../state/persistence.js"
import type { ApprovalStatus, Phase } from "../state/types.js"

const NEXT_PHASE: Record<string, Phase> = {
  research: "plan",
  plan: "features",
  features: "execute"
}

export const createApprovePhase = (workdir: string): ToolDefinition => tool({
  description: `Record human approval decision for a globex phase (research, plan, or features).

On approved: transitions to next phase (research→plan, plan→features, features→execute).
On rejected: stays at current phase for rework.
Returns: "Phase {phase} {status}. Current phase: {currentPhase}"`,
  args: {
    phase: tool.schema.enum(["research", "plan", "features"]),
    status: tool.schema.enum(["approved", "rejected"]),
    notes: tool.schema.string().optional(),
  },
  async execute(args) {
    const phase = args.phase as "research" | "plan" | "features"
    const status = args.status as ApprovalStatus
    
    const approval = {
      status,
      timestamp: new Date().toISOString(),
      notes: args.notes
    }
    
    const effect = Effect.gen(function* () {
      yield* recordApproval(workdir, phase, approval)
      
      if (status === "approved") {
        const nextPhase = NEXT_PHASE[phase]
        if (nextPhase) {
          yield* updatePhase(workdir, nextPhase)
        }
      } else if (status === "rejected") {
        // Go back to the work phase (not interview phase)
        const workPhase = phase
        yield* updatePhase(workdir, workPhase)
      }
      
      return yield* readState(workdir)
    })
    
    const state = await Effect.runPromise(effect)
    return `Phase ${phase} ${status}. Current phase: ${state.currentPhase}`
  },
})
