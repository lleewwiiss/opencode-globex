import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { Effect } from "effect"
import { recordApproval } from "../../src/phases/approval.js"
import { writeState } from "../../src/state/persistence.js"
import type { GlobexState } from "../../src/state/types.js"

const createTestState = (phase: GlobexState["currentPhase"]): GlobexState => ({
  projectName: "test",
  description: "test project",
  currentPhase: phase,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  approvals: {},
  artifacts: {},
  interviewHistory: {},
})

describe("cli/phases/approval", () => {
  let testDir: string
  const projectId = "test-project"

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-approval-test-"))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("recordApproval", () => {
    test("records approval in state.approvals", async () => {
      const state = createTestState("research")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(
        recordApproval(testDir, projectId, "research", "approved", "looks good")
      )

      expect(result.approvals.research).toBeDefined()
      expect(result.approvals.research?.status).toBe("approved")
      expect(result.approvals.research?.notes).toBe("looks good")
      expect(result.approvals.research?.timestamp).toBeDefined()
    })

    test("approved status triggers transition to next phase (research → research_interview)", async () => {
      const state = createTestState("research")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(
        recordApproval(testDir, projectId, "research", "approved")
      )

      expect(result.currentPhase).toBe("research_interview")
    })

    test("approved_with_risks also triggers transition", async () => {
      const state = createTestState("research")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(
        recordApproval(testDir, projectId, "research", "approved_with_risks", "minor concerns")
      )

      expect(result.currentPhase).toBe("research_interview")
      expect(result.approvals.research?.status).toBe("approved_with_risks")
    })

    test("rejected status stays at current phase", async () => {
      const state = createTestState("research")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(
        recordApproval(testDir, projectId, "research", "rejected", "needs more work")
      )

      expect(result.currentPhase).toBe("research")
      expect(result.approvals.research?.status).toBe("rejected")
      expect(result.approvals.research?.notes).toBe("needs more work")
    })

    test("pending status stays at current phase", async () => {
      const state = createTestState("plan")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(
        recordApproval(testDir, projectId, "plan", "pending")
      )

      expect(result.currentPhase).toBe("plan")
      expect(result.approvals.plan?.status).toBe("pending")
    })

    test("plan approval advances to plan_interview", async () => {
      const state = createTestState("plan")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(
        recordApproval(testDir, projectId, "plan", "approved")
      )

      expect(result.currentPhase).toBe("plan_interview")
    })

    test("features approval advances to execute", async () => {
      const state = createTestState("features")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(
        recordApproval(testDir, projectId, "features", "approved")
      )

      expect(result.currentPhase).toBe("execute")
    })
  })
})
