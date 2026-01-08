import { Effect, Schema } from "effect"
import { type Phase, PHASE_TRANSITIONS, type GlobexState } from "../state/types.js"

export class InvalidTransitionError extends Schema.TaggedError<InvalidTransitionError>()(
  "InvalidTransitionError",
  {
    from: Schema.String,
    to: Schema.String,
    validTargets: Schema.Array(Schema.String),
  }
) {}

export const isValidTransition = (from: Phase, to: Phase): boolean => {
  const validTargets = PHASE_TRANSITIONS[from]
  return validTargets.includes(to)
}

export const transitionPhase = (
  state: GlobexState,
  to: Phase
): Effect.Effect<GlobexState, InvalidTransitionError> =>
  Effect.gen(function* () {
    const from = state.currentPhase
    const validTargets = PHASE_TRANSITIONS[from]

    if (!validTargets.includes(to)) {
      return yield* Effect.fail(
        new InvalidTransitionError({
          from,
          to,
          validTargets,
        })
      )
    }

    return {
      ...state,
      currentPhase: to,
      updatedAt: new Date().toISOString(),
    }
  })

export { PHASE_TRANSITIONS }
