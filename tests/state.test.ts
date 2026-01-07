import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import {
  createInitialState,
  readState,
  writeState,
  updatePhase,
  recordApproval,
  recordArtifact,
  stateExists,
  getGlobexDir,
  getStatePath,
  StateNotFoundError,
} from "../src/state/persistence"
import type { GlobexState, Phase, Approval } from "../src/state/types"

describe("state persistence", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-test-"))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("createInitialState", () => {
    test("creates state with correct defaults", () => {
      const state = createInitialState("test-project", "A test description")
      
      expect(state.projectName).toBe("test-project")
      expect(state.description).toBe("A test description")
      expect(state.currentPhase).toBe("init")
      expect(state.approvals).toEqual({})
      expect(state.artifacts).toEqual({})
      expect(state.interviewHistory).toEqual({})
      expect(state.createdAt).toBeDefined()
      expect(state.updatedAt).toBeDefined()
    })
  })

  describe("stateExists", () => {
    test("returns false when no state file", async () => {
      const exists = await stateExists(testDir)
      expect(exists).toBe(false)
    })

    test("returns true when state file exists", async () => {
      const state = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, state))
      
      const exists = await stateExists(testDir)
      expect(exists).toBe(true)
    })
  })

  describe("writeState / readState", () => {
    test("writes and reads state correctly", async () => {
      const state = createInitialState("my-project", "My description")
      
      await Effect.runPromise(writeState(testDir, state))
      const read = await Effect.runPromise(readState(testDir))
      
      expect(read.projectName).toBe("my-project")
      expect(read.description).toBe("My description")
      expect(read.currentPhase).toBe("init")
    })

    test("creates .globex directory if not exists", async () => {
      const state = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, state))
      
      const globexDir = getGlobexDir(testDir)
      const stat = await fs.stat(globexDir)
      expect(stat.isDirectory()).toBe(true)
    })

    test("throws StateNotFoundError when file missing", async () => {
      const result = await Effect.runPromiseExit(readState(testDir))
      
      expect(result._tag).toBe("Failure")
    })
  })

  describe("updatePhase", () => {
    test("updates phase correctly", async () => {
      const initial = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, initial))
      
      const updated = await Effect.runPromise(updatePhase(testDir, "research"))
      
      expect(updated.currentPhase).toBe("research")
    })

    test("preserves other state fields", async () => {
      const initial = createInitialState("test", "My description")
      await Effect.runPromise(writeState(testDir, initial))
      
      const updated = await Effect.runPromise(updatePhase(testDir, "research"))
      
      expect(updated.projectName).toBe("test")
      expect(updated.description).toBe("My description")
    })
  })

  describe("recordApproval", () => {
    test("records approval for phase", async () => {
      const initial = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, initial))
      
      const approval: Approval = {
        status: "approved",
        timestamp: new Date().toISOString(),
      }
      
      const updated = await Effect.runPromise(
        recordApproval(testDir, "research", approval)
      )
      
      expect(updated.approvals.research?.status).toBe("approved")
    })

    test("records approval with risks", async () => {
      const initial = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, initial))
      
      const approval: Approval = {
        status: "approved_with_risks",
        timestamp: new Date().toISOString(),
        risks: ["Risk 1", "Risk 2"],
        notes: "Proceed carefully",
      }
      
      const updated = await Effect.runPromise(
        recordApproval(testDir, "plan", approval)
      )
      
      expect(updated.approvals.plan?.status).toBe("approved_with_risks")
      expect(updated.approvals.plan?.risks).toEqual(["Risk 1", "Risk 2"])
      expect(updated.approvals.plan?.notes).toBe("Proceed carefully")
    })
  })

  describe("recordArtifact", () => {
    test("records artifact path", async () => {
      const initial = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, initial))
      
      const updated = await Effect.runPromise(
        recordArtifact(testDir, "research.md", ".globex/research.md")
      )
      
      expect(updated.artifacts["research.md"]).toBe(".globex/research.md")
    })

    test("records multiple artifacts", async () => {
      const initial = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, initial))
      
      await Effect.runPromise(
        recordArtifact(testDir, "research.md", ".globex/research.md")
      )
      const updated = await Effect.runPromise(
        recordArtifact(testDir, "plan.md", ".globex/plan.md")
      )
      
      expect(updated.artifacts["research.md"]).toBe(".globex/research.md")
      expect(updated.artifacts["plan.md"]).toBe(".globex/plan.md")
    })
  })

  describe("path helpers", () => {
    test("getGlobexDir returns correct path", () => {
      expect(getGlobexDir("/foo/bar")).toBe("/foo/bar/.globex")
    })

    test("getStatePath returns correct path", () => {
      expect(getStatePath("/foo/bar")).toBe("/foo/bar/.globex/state.json")
    })
  })
})

describe("state types", () => {
  test("PHASE_ORDER has correct sequence", async () => {
    const { PHASE_ORDER } = await import("../src/state/types")
    
    expect(PHASE_ORDER[0]).toBe("init")
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe("complete")
    expect(PHASE_ORDER).toContain("research")
    expect(PHASE_ORDER).toContain("execute")
  })

  test("PHASE_TRANSITIONS allows valid transitions", async () => {
    const { PHASE_TRANSITIONS } = await import("../src/state/types")
    
    expect(PHASE_TRANSITIONS.init).toContain("research")
    expect(PHASE_TRANSITIONS.research).toContain("research_interview")
    expect(PHASE_TRANSITIONS.research_interview).toContain("plan")
    expect(PHASE_TRANSITIONS.research_interview).toContain("research")
  })
})
