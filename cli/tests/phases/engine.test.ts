import { describe, test, expect } from "bun:test"
import { Effect, Exit } from "effect"
import {
  transitionPhase,
  isValidTransition,
  InvalidTransitionError,
  PHASE_TRANSITIONS,
} from "../../src/phases/engine.js"
import type { GlobexState } from "../../src/state/types.js"

const createTestState = (phase: GlobexState["currentPhase"]): GlobexState => ({
  projectName: "test",
  description: "test",
  currentPhase: phase,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  approvals: {},
  artifacts: {},
  interviewHistory: {},
})

describe("cli/phases/engine", () => {
  describe("PHASE_TRANSITIONS", () => {
    test("exports phase transitions map", () => {
      expect(PHASE_TRANSITIONS).toBeDefined()
      expect(PHASE_TRANSITIONS.init).toContain("research")
    })
  })

  describe("isValidTransition", () => {
    test("returns true for valid transitions", () => {
      expect(isValidTransition("init", "research")).toBe(true)
      expect(isValidTransition("research", "research_interview")).toBe(true)
      expect(isValidTransition("research_interview", "plan")).toBe(true)
      expect(isValidTransition("research_interview", "research")).toBe(true)
    })

    test("returns false for invalid transitions", () => {
      expect(isValidTransition("init", "plan")).toBe(false)
      expect(isValidTransition("research", "execute")).toBe(false)
      expect(isValidTransition("complete", "init")).toBe(false)
    })
  })

  describe("transitionPhase", () => {
    test("succeeds for valid transition", async () => {
      const state = createTestState("init")
      const result = await Effect.runPromise(transitionPhase(state, "research"))

      expect(result.currentPhase).toBe("research")
      expect(result.projectName).toBe("test")
    })

    test("updates updatedAt timestamp", async () => {
      const state = createTestState("init")
      const oldTimestamp = state.updatedAt
      await new Promise((r) => setTimeout(r, 10))
      const result = await Effect.runPromise(transitionPhase(state, "research"))

      expect(result.updatedAt).not.toBe(oldTimestamp)
    })

    test("fails with InvalidTransitionError for invalid transition", async () => {
      const state = createTestState("init")
      const exit = await Effect.runPromiseExit(transitionPhase(state, "execute"))

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = exit.cause
        expect(error._tag).toBe("Fail")
      }
    })

    test("InvalidTransitionError contains correct details", async () => {
      const state = createTestState("init")
      const exit = await Effect.runPromiseExit(transitionPhase(state, "execute"))

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error as InvalidTransitionError
        expect(error._tag).toBe("InvalidTransitionError")
        expect(error.from).toBe("init")
        expect(error.to).toBe("execute")
        expect(error.validTargets).toEqual(["research"])
      }
    })
  })
})
