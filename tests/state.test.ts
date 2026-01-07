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
  getLoopStatePath,
  loadLoopStateAsync,
  saveLoopStateAsync,
  clearLoopStateAsync,
  StateNotFoundError,
} from "../src/state/persistence"
import type { GlobexState, Phase, Approval, LoopState } from "../src/state/types"

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
      
      const updated = await Effect.runPromise(updatePhase(testDir, "plan"))
      
      expect(updated.currentPhase).toBe("plan")
    })

    test("preserves other state fields", async () => {
      const initial = createInitialState("test", "My description")
      await Effect.runPromise(writeState(testDir, initial))
      
      const updated = await Effect.runPromise(updatePhase(testDir, "plan"))
      
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
        recordApproval(testDir, "plan", approval)
      )
      
      expect(updated.approvals.plan?.status).toBe("approved")
    })

    test("records approval with notes", async () => {
      const initial = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, initial))
      
      const approval: Approval = {
        status: "approved",
        timestamp: new Date().toISOString(),
        notes: "Looks good",
      }
      
      const updated = await Effect.runPromise(
        recordApproval(testDir, "plan", approval)
      )
      
      expect(updated.approvals.plan?.status).toBe("approved")
      expect(updated.approvals.plan?.notes).toBe("Looks good")
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
    test("getGlobexDir returns base path without projectId", () => {
      expect(getGlobexDir("/foo/bar")).toBe("/foo/bar/.globex")
    })

    test("getGlobexDir returns project path with projectId", () => {
      expect(getGlobexDir("/foo/bar", "myproject")).toBe("/foo/bar/.globex/projects/myproject")
    })

    test("getStatePath returns correct path for default project", () => {
      expect(getStatePath("/foo/bar")).toBe("/foo/bar/.globex/projects/default/state.json")
    })

    test("getStatePath returns correct path with projectId", () => {
      expect(getStatePath("/foo/bar", "myproject")).toBe("/foo/bar/.globex/projects/myproject/state.json")
    })
  })
})

describe("loop state persistence", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-test-"))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  test("loadLoopState returns null when no state", async () => {
    const state = await loadLoopStateAsync(testDir)
    expect(state).toBeNull()
  })

  test("saveLoopState creates file", async () => {
    const loopState: LoopState = {
      status: "running",
      iteration: 1,
      completedFeatures: [],
      blockedFeatures: []
    }
    
    await saveLoopStateAsync(testDir, loopState)
    
    const loopStatePath = getLoopStatePath(testDir)
    const exists = await fs.access(loopStatePath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  test("loadLoopState returns saved state", async () => {
    const loopState: LoopState = {
      status: "paused",
      iteration: 3,
      currentFeatureId: "F001",
      lastCommitHash: "abc123",
      totalIterations: 10,
      startedAt: "2024-01-01T10:00:00.000Z",
      pausedAt: "2024-01-01T11:30:00.000Z",
      ralphSessionId: "ralph-session-123",
      wiggumSessionId: "wiggum-session-456",
      lastSignal: "approved",
      completedFeatures: ["F001", "F002"],
      blockedFeatures: ["F005"]
    }
    
    await saveLoopStateAsync(testDir, loopState)
    const loaded = await loadLoopStateAsync(testDir)
    
    expect(loaded).toEqual(loopState)
  })

  test("clearLoopState removes file", async () => {
    const loopState: LoopState = {
      status: "complete",
      iteration: 5,
      completedFeatures: [],
      blockedFeatures: []
    }
    
    await saveLoopStateAsync(testDir, loopState)
    await clearLoopStateAsync(testDir)
    
    const loopStatePath = getLoopStatePath(testDir)
    const exists = await fs.access(loopStatePath).then(() => true).catch(() => false)
    expect(exists).toBe(false)
  })

  test("schema validation of malformed state", async () => {
    const loopStatePath = getLoopStatePath(testDir)
    const dir = path.dirname(loopStatePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(loopStatePath, '{"invalid": "json", "status": 123}')
    
    const loaded = await loadLoopStateAsync(testDir)
    
    // loadLoopState catches parse errors and returns the JSON as-is
    // This test verifies it doesn't crash on malformed data
    expect(loaded).toBeTruthy()
    expect(typeof loaded).toBe("object")
  })
})

describe("state types", () => {
  test("PHASE_ORDER has correct sequence", async () => {
    const { PHASE_ORDER } = await import("../src/state/types")
    
    expect(PHASE_ORDER[0]).toBe("init")
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe("complete")
    expect(PHASE_ORDER).toContain("research")
    expect(PHASE_ORDER).toContain("research_interview")
    expect(PHASE_ORDER).toContain("plan")
    expect(PHASE_ORDER).toContain("plan_interview")
    expect(PHASE_ORDER).toContain("features")
    expect(PHASE_ORDER).toContain("execute")
  })

  test("PHASE_TRANSITIONS allows valid transitions", async () => {
    const { PHASE_TRANSITIONS } = await import("../src/state/types")
    
    // Flow: init → research → research_interview → plan → plan_interview → features → execute → complete
    expect(PHASE_TRANSITIONS.init).toContain("research")
    expect(PHASE_TRANSITIONS.research).toContain("research_interview")
    expect(PHASE_TRANSITIONS.research_interview).toContain("plan")
    expect(PHASE_TRANSITIONS.research_interview).toContain("research") // can go back to rework
    expect(PHASE_TRANSITIONS.plan).toContain("plan_interview")
    expect(PHASE_TRANSITIONS.plan_interview).toContain("features")
    expect(PHASE_TRANSITIONS.plan_interview).toContain("plan") // can go back to rework
    expect(PHASE_TRANSITIONS.features).toContain("execute")
  })
})
