import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { createInitialState, writeState, getProjectDir, setActiveProject, DEFAULT_PROJECT } from "../src/state/persistence"

describe("tools", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-tools-test-"))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("globex_init", () => {
    test("creates initial state", async () => {
      const { createGlobexInit } = await import("../src/tools/globex-init")
      const tool = createGlobexInit(testDir)
      
      const result = await tool.execute(
        { projectName: "test-proj", description: "Test description" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.projectName).toBe("test-proj")
      expect(parsed.phase).toBe("init")
    })

    test("fails if project already exists", async () => {
      const { createGlobexInit } = await import("../src/tools/globex-init")
      const tool = createGlobexInit(testDir)
      
      await tool.execute(
        { projectName: "test", description: "desc" },
        mockContext()
      )
      
      const result = await tool.execute(
        { projectName: "test", description: "same name again" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain("already exists")
    })
  })

  describe("globex_status", () => {
    test("returns not found when no project", async () => {
      const { createGlobexStatus } = await import("../src/tools/globex-status")
      const tool = createGlobexStatus(testDir)
      
      const result = await tool.execute({}, mockContext())
      
      expect(result).toContain("No globex project found")
    })

    test("returns status when project exists", async () => {
      const state = createInitialState("my-project", "desc")
      await Effect.runPromise(writeState(testDir, state))
      
      const { createGlobexStatus } = await import("../src/tools/globex-status")
      const tool = createGlobexStatus(testDir)
      
      const result = await tool.execute({}, mockContext())
      
      expect(result).toContain("my-project")
      expect(result).toContain("init")
    })
  })

  describe("save_artifact", () => {
    test("saves artifact to .globex directory", async () => {
      const state = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, state))
      
      const { createSaveArtifact } = await import("../src/tools/save-artifact")
      const tool = createSaveArtifact(testDir)
      
      const result = await tool.execute(
        { name: "research.md", content: "# Research\n\nFindings here" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.artifact).toBe("research.md")
      
      const artifactPath = path.join(getProjectDir(testDir, DEFAULT_PROJECT), "research.md")
      const content = await fs.readFile(artifactPath, "utf-8")
      expect(content).toBe("# Research\n\nFindings here")
    })
  })

  describe("verify_citation", () => {
    test("verifies valid citation", async () => {
      const testFile = path.join(testDir, "test.ts")
      await fs.writeFile(testFile, "line 1\nline 2\nline 3\nline 4\nline 5")
      
      const { createVerifyCitation } = await import("../src/tools/verify-citation")
      const tool = createVerifyCitation(testDir)
      
      const result = await tool.execute(
        { filePath: "test.ts", lineStart: 2, lineEnd: 3 },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.valid).toBe(true)
      expect(parsed.excerpt).toContain("line 2")
      expect(parsed.hash).toBeDefined()
    })

    test("returns invalid for missing file", async () => {
      const { createVerifyCitation } = await import("../src/tools/verify-citation")
      const tool = createVerifyCitation(testDir)
      
      const result = await tool.execute(
        { filePath: "nonexistent.ts", lineStart: 1, lineEnd: 1 },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.valid).toBe(false)
      expect(parsed.reason).toContain("not found")
    })

    test("returns invalid for out of bounds lines", async () => {
      const testFile = path.join(testDir, "test.ts")
      await fs.writeFile(testFile, "line 1\nline 2")
      
      const { createVerifyCitation } = await import("../src/tools/verify-citation")
      const tool = createVerifyCitation(testDir)
      
      const result = await tool.execute(
        { filePath: "test.ts", lineStart: 1, lineEnd: 100 },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.valid).toBe(false)
      expect(parsed.reason).toContain("out of bounds")
    })
  })

  describe("update_feature", () => {
    test("updates feature passes status", async () => {
      await setupFeaturesFile(testDir)
      
      const { createUpdateFeature } = await import("../src/tools/update-feature")
      const tool = createUpdateFeature(testDir)
      
      const result = await tool.execute(
        { featureId: "F001", passes: true },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.passes).toBe(true)
      expect(parsed.progress).toContain("1/2")
    })

    test("updates feature blocked status", async () => {
      await setupFeaturesFile(testDir)
      
      const { createUpdateFeature } = await import("../src/tools/update-feature")
      const tool = createUpdateFeature(testDir)
      
      const result = await tool.execute(
        { featureId: "F001", blocked: true, blockedReason: "Missing dependency" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.blocked).toBe(true)
    })

    test("requires passes or blocked status", async () => {
      await setupFeaturesFile(testDir)
      
      const { createUpdateFeature } = await import("../src/tools/update-feature")
      const tool = createUpdateFeature(testDir)
      
      const result = await tool.execute(
        { featureId: "F001", notes: "just a note" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain("Must provide either")
    })

    test("returns error for nonexistent feature", async () => {
      await setupFeaturesFile(testDir)
      
      const { createUpdateFeature } = await import("../src/tools/update-feature")
      const tool = createUpdateFeature(testDir)
      
      const result = await tool.execute(
        { featureId: "F999", passes: true },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain("not found")
    })
  })

  describe("get_next_feature", () => {
    test("returns next eligible feature", async () => {
      await setupFeaturesFile(testDir)
      
      const { createGetNextFeature } = await import("../src/tools/get-next-feature")
      const tool = createGetNextFeature(testDir)
      
      const result = await tool.execute({}, mockContext())
      
      const parsed = JSON.parse(result)
      expect(parsed.feature).toBeDefined()
      expect(parsed.feature.id).toBe("F001")
      expect(parsed.progress.remaining).toBe(2)
    })

    test("returns done when all complete", async () => {
      await setupFeaturesFile(testDir, { allComplete: true })
      
      const { createGetNextFeature } = await import("../src/tools/get-next-feature")
      const tool = createGetNextFeature(testDir)
      
      const result = await tool.execute({}, mockContext())
      
      const parsed = JSON.parse(result)
      expect(parsed.done).toBe(true)
    })

    test("returns blocked when deps not satisfied", async () => {
      await setupFeaturesFile(testDir, { blockedDeps: true })
      
      const { createGetNextFeature } = await import("../src/tools/get-next-feature")
      const tool = createGetNextFeature(testDir)
      
      const result = await tool.execute({}, mockContext())
      
      const parsed = JSON.parse(result)
      expect(parsed.blocked).toBe(true)
    })
  })

  describe("check_convergence", () => {
    test("tracks interview progress", async () => {
      const state = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, state))
      
      const { createCheckConvergence } = await import("../src/tools/check-convergence")
      const tool = createCheckConvergence(testDir)
      
      const result = await tool.execute(
        { phase: "plan", questionsThisRound: 5, newGapsFound: true },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.shouldStop).toBe(false)
      expect(parsed.questionsAsked).toBe(5)
      expect(parsed.convergenceRound).toBe(1)
    })

    test("signals stop when converged after min questions", async () => {
      const state = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, state))
      
      const { createCheckConvergence } = await import("../src/tools/check-convergence")
      const tool = createCheckConvergence(testDir)
      
      // First round: 10 questions, no new gaps (meets MIN_QUESTIONS=10)
      await tool.execute(
        { phase: "plan", questionsThisRound: 10, newGapsFound: false },
        mockContext()
      )
      // Second round: no new gaps again (streak=2, triggers convergence)
      const result = await tool.execute(
        { phase: "plan", questionsThisRound: 2, newGapsFound: false },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.shouldStop).toBe(true)
      expect(parsed.reason).toBe("converged_no_new_gaps")
    })

    test("continues when under min questions even with no gaps", async () => {
      const state = createInitialState("test", "desc")
      await Effect.runPromise(writeState(testDir, state))
      
      const { createCheckConvergence } = await import("../src/tools/check-convergence")
      const tool = createCheckConvergence(testDir)
      
      // Only 5 questions - under MIN_QUESTIONS=10
      await tool.execute(
        { phase: "plan", questionsThisRound: 3, newGapsFound: false },
        mockContext()
      )
      const result = await tool.execute(
        { phase: "plan", questionsThisRound: 2, newGapsFound: false },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      // Should continue because only 5 questions asked (under MIN_QUESTIONS=10)
      expect(parsed.shouldStop).toBe(false)
      expect(parsed.questionsAsked).toBe(5)
    })
  })

  describe("approve_phase", () => {
    test("records approval and transitions phase", async () => {
      const state = createInitialState("test", "desc")
      state.currentPhase = "plan"
      await Effect.runPromise(writeState(testDir, state))
      
      const { createApprovePhase } = await import("../src/tools/approve-phase")
      const tool = createApprovePhase(testDir)
      
      const result = await tool.execute(
        { phase: "plan", status: "approved" },
        mockContext()
      )
      
      expect(result).toContain("approved")
      expect(result).toContain("interview")
    })

    test("records rejection and stays in phase", async () => {
      const state = createInitialState("test", "desc")
      state.currentPhase = "plan"
      await Effect.runPromise(writeState(testDir, state))
      
      const { createApprovePhase } = await import("../src/tools/approve-phase")
      const tool = createApprovePhase(testDir)
      
      const result = await tool.execute(
        { phase: "plan", status: "rejected", notes: "Need more detail" },
        mockContext()
      )
      
      expect(result).toContain("rejected")
      expect(result).toContain("plan")
    })
  })

  describe("update_progress", () => {
    test("generates progress.md", async () => {
      await setupFeaturesFile(testDir)
      
      const { createUpdateProgress } = await import("../src/tools/update-progress")
      const tool = createUpdateProgress(testDir)
      
      const result = await tool.execute(
        { currentFeatureId: "F001" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      
      const progressPath = path.join(getProjectDir(testDir, DEFAULT_PROJECT), "progress.md")
      const content = await fs.readFile(progressPath, "utf-8")
      expect(content).toContain("# Progress")
      expect(content).toContain("F001")
    })
  })

  describe("add_learning", () => {
    test("creates AGENTS.md if missing", async () => {
      const { createAddLearning } = await import("../src/tools/add-learning")
      const tool = createAddLearning(testDir)
      
      const result = await tool.execute(
        { learning: "Run migrations before seeding" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.action).toBe("added")
      
      const agentsPath = path.join(testDir, "AGENTS.md")
      const content = await fs.readFile(agentsPath, "utf-8")
      expect(content).toContain("# AGENTS.md")
      expect(content).toContain("Run migrations before seeding")
      expect(content).toContain("## Globex Learnings (auto-generated)")
    })

    test("appends learning to existing AGENTS.md", async () => {
      const agentsPath = path.join(testDir, "AGENTS.md")
      await fs.writeFile(agentsPath, "# Project Instructions\n\nExisting content here.\n")
      
      const { createAddLearning } = await import("../src/tools/add-learning")
      const tool = createAddLearning(testDir)
      
      const result = await tool.execute(
        { learning: "Build requires NODE_ENV=production" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.action).toBe("added")
      
      const content = await fs.readFile(agentsPath, "utf-8")
      expect(content).toContain("Existing content here")
      expect(content).toContain("Build requires NODE_ENV=production")
      expect(content).toContain("## Globex Learnings (auto-generated)")
    })

    test("prevents duplicate learnings", async () => {
      const { createAddLearning } = await import("../src/tools/add-learning")
      const tool = createAddLearning(testDir)
      
      await tool.execute(
        { learning: "Use bun instead of npm" },
        mockContext()
      )
      
      const result = await tool.execute(
        { learning: "Use bun instead of npm" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      expect(parsed.action).toBe("skipped")
      expect(parsed.reason).toContain("already exists")
      
      const agentsPath = path.join(testDir, "AGENTS.md")
      const content = await fs.readFile(agentsPath, "utf-8")
      const matches = content.match(/Use bun instead of npm/g)
      expect(matches?.length).toBe(1)
    })

    test("appends to existing learnings section", async () => {
      const agentsPath = path.join(testDir, "AGENTS.md")
      const existingContent = `# AGENTS.md

Project instructions.

## Globex Learnings (auto-generated)

- First learning
<!-- end globex learnings -->
`
      await fs.writeFile(agentsPath, existingContent)
      
      const { createAddLearning } = await import("../src/tools/add-learning")
      const tool = createAddLearning(testDir)
      
      const result = await tool.execute(
        { learning: "Second learning" },
        mockContext()
      )
      
      const parsed = JSON.parse(result)
      expect(parsed.success).toBe(true)
      
      const content = await fs.readFile(agentsPath, "utf-8")
      expect(content).toContain("- First learning")
      expect(content).toContain("- Second learning")
      const firstIndex = content.indexOf("First learning")
      const secondIndex = content.indexOf("Second learning")
      expect(secondIndex).toBeGreaterThan(firstIndex)
    })
  })
})

function mockContext() {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    agent: "test-agent",
    abort: new AbortController().signal,
  }
}

async function setupFeaturesFile(
  dir: string,
  opts: { allComplete?: boolean; blockedDeps?: boolean } = {}
) {
  const globexDir = getProjectDir(dir, DEFAULT_PROJECT)
  await fs.mkdir(globexDir, { recursive: true })
  
  let features
  
  if (opts.allComplete) {
    features = {
      features: [
        { id: "F001", description: "Feature 1", passes: true, priority: 1, dependencies: [] },
        { id: "F002", description: "Feature 2", passes: true, priority: 2, dependencies: [] },
      ],
    }
  } else if (opts.blockedDeps) {
    features = {
      features: [
        { id: "F001", description: "Feature 1", passes: false, priority: 1, dependencies: ["F002"] },
        { id: "F002", description: "Feature 2", passes: false, priority: 2, dependencies: ["F001"] },
      ],
    }
  } else {
    features = {
      features: [
        { id: "F001", description: "Feature 1", passes: false, priority: 1, dependencies: [] },
        { id: "F002", description: "Feature 2", passes: false, priority: 2, dependencies: ["F001"] },
      ],
    }
  }
  
  await fs.writeFile(
    path.join(globexDir, "features.json"),
    JSON.stringify(features, null, 2)
  )
  
  const state = {
    currentPhase: "execute",
    projectName: "test-project",
    description: "Test description",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvals: {},
    artifacts: {},
    interviewHistory: {},
    execution: {
      iteration: 1,
      maxIterations: 100,
      startedAt: new Date().toISOString(),
      lastIterationAt: new Date().toISOString(),
      completionPromise: "ALL_FEATURES_COMPLETE",
      learnings: [],
    },
  }
  
  await fs.writeFile(
    path.join(globexDir, "state.json"),
    JSON.stringify(state, null, 2)
  )
}
