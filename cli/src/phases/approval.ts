import { Effect } from "effect"
import type { Phase, ApprovalStatus, Approval, GlobexState } from "../state/types.js"
import { readState, writeState } from "../state/persistence.js"
import { transitionPhase } from "./engine.js"

type ApprovablePhase = "research" | "plan" | "features"

const NEXT_PHASE: Record<ApprovablePhase, Phase> = {
  research: "research_interview",
  plan: "plan_interview",
  features: "execute",
}

export const recordApproval = (
  workdir: string,
  projectId: string,
  phase: ApprovablePhase,
  status: ApprovalStatus,
  notes?: string
): Effect.Effect<GlobexState, Error> =>
  Effect.gen(function* () {
    const state = yield* readState(workdir, projectId).pipe(
      Effect.mapError((e) => new Error(`Failed to read state: ${e._tag}`))
    )

    const approval: Approval = {
      status,
      timestamp: new Date().toISOString(),
      notes,
    }

    const updatedState: GlobexState = {
      ...state,
      approvals: { ...state.approvals, [phase]: approval },
    }

    const isApproved = status === "approved" || status === "approved_with_risks"

    if (isApproved) {
      const nextPhase = NEXT_PHASE[phase]
      const transitioned = yield* transitionPhase(updatedState, nextPhase).pipe(
        Effect.mapError((e) => new Error(`Invalid transition: ${e.from} -> ${e.to}`))
      )
      yield* writeState(workdir, projectId, transitioned).pipe(
        Effect.mapError((e) => new Error(`Failed to write state: ${e.message}`))
      )
      return transitioned
    }

    yield* writeState(workdir, projectId, updatedState).pipe(
      Effect.mapError((e) => new Error(`Failed to write state: ${e.message}`))
    )
    return updatedState
  })

export const recordApprovalAsync = async (
  workdir: string,
  projectId: string,
  phase: ApprovablePhase,
  status: ApprovalStatus,
  notes?: string
): Promise<GlobexState> =>
  Effect.runPromise(recordApproval(workdir, projectId, phase, status, notes))

export type { ApprovablePhase }
