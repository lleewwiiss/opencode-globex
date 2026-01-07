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

On approved/approved_with_risks: transitions to next phase (research→plan→features→execute).
On rejected: stays at current phase for rework.
Returns: "Phase {phase} {status}. Current phase: {currentPhase}"`,
  args: {
    phase: tool.schema.enum(["research", "plan", "features"]),
    status: tool.schema.enum(["approved", "approved_with_risks", "rejected"]),
    risks: tool.schema.array(tool.schema.string()).optional(),
    notes: tool.schema.string().optional(),
  },
  async execute(args) {
    const phase = args.phase as "research" | "plan" | "features"
    const status = args.status as ApprovalStatus
    
    const approval = {
      status,
      timestamp: new Date().toISOString(),
      risks: args.risks,
      notes: args.notes
    }
    
    const effect = Effect.gen(function* () {
      yield* recordApproval(workdir, phase, approval)
      
      if (status === "approved" || status === "approved_with_risks") {
        const nextPhase = NEXT_PHASE[phase]
        if (nextPhase) {
          yield* updatePhase(workdir, nextPhase)
        }
      } else if (status === "rejected") {
        yield* updatePhase(workdir, phase)
      }
      
      return yield* readState(workdir)
    })
    
    const state = await Effect.runPromise(effect)
    return `Phase ${phase} ${status}. Current phase: ${state.currentPhase}`
  },
})
