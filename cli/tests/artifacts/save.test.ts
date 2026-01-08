import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { saveArtifact, saveArtifactAsync } from "../../src/artifacts/save.js"
import { writeState, readState, getProjectDir } from "../../src/state/persistence.js"
import type { GlobexState } from "../../src/state/types.js"

const createTestState = (phase: GlobexState["currentPhase"]): GlobexState => ({
  projectName: "test-project",
  description: "Test description",
  currentPhase: phase,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  approvals: {},
  artifacts: {},
  interviewHistory: {},
})

const validFeaturesJson = JSON.stringify({
  features: [
    {
      id: "feat-1",
      description: "Test feature",
      passes: false,
      priority: 1,
      dependencies: [],
    },
  ],
})

const invalidFeaturesJson = JSON.stringify({
  features: [
    {
      id: "feat-1",
      description: "Missing required fields",
    },
  ],
})

describe("saveArtifact", () => {
  let testDir: string
  const projectId = "test-project-id"

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-save-test-"))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("features.json validation", () => {
    test("valid features.json succeeds, saves file, updates state.artifacts", async () => {
      const state = createTestState("features")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(saveArtifact(testDir, projectId, "features.json", validFeaturesJson))

      expect(result.success).toBe(true)
      expect(result.artifact).toBe("features.json")

      const projectDir = getProjectDir(testDir, projectId)
      const fileContent = await fs.readFile(path.join(projectDir, "features.json"), "utf-8")
      expect(fileContent).toBe(validFeaturesJson)

      const updatedState = await Effect.runPromise(readState(testDir, projectId))
      expect(updatedState.artifacts["features.json"]).toBeDefined()
    })

    test("invalid features.json fails validation, returns errors, file NOT written", async () => {
      const state = createTestState("features")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(saveArtifact(testDir, projectId, "features.json", invalidFeaturesJson))

      expect(result.success).toBe(false)
      expect(result.artifact).toBe("features.json")
      expect(result.error).toContain("Validation failed")

      const projectDir = getProjectDir(testDir, projectId)
      const fileExists = await fs.access(path.join(projectDir, "features.json")).then(() => true).catch(() => false)
      expect(fileExists).toBe(false)
    })
  })

  describe("markdown artifacts", () => {
    test("markdown artifact saved as-is without validation", async () => {
      const state = createTestState("research")
      await Effect.runPromise(writeState(testDir, projectId, state))
      const markdownContent = "# Research Notes\n\nSome **bold** text and `code`"

      const result = await Effect.runPromise(saveArtifact(testDir, projectId, "research.md", markdownContent))

      expect(result.success).toBe(true)
      expect(result.artifact).toBe("research.md")

      const projectDir = getProjectDir(testDir, projectId)
      const fileContent = await fs.readFile(path.join(projectDir, "research.md"), "utf-8")
      expect(fileContent).toBe(markdownContent)

      const updatedState = await Effect.runPromise(readState(testDir, projectId))
      expect(updatedState.artifacts["research.md"]).toBeDefined()
    })
  })

  describe("phase transitions", () => {
    test("features.json triggers phase transition from features to execute", async () => {
      const state = createTestState("features")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(saveArtifact(testDir, projectId, "features.json", validFeaturesJson))

      expect(result.success).toBe(true)
      expect(result.phaseTransitioned).toBe("execute")

      const updatedState = await Effect.runPromise(readState(testDir, projectId))
      expect(updatedState.currentPhase).toBe("execute")
    })

    test("research.md triggers phase transition from research to research_interview", async () => {
      const state = createTestState("research")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(saveArtifact(testDir, projectId, "research.md", "# Research"))

      expect(result.success).toBe(true)
      expect(result.phaseTransitioned).toBe("research_interview")

      const updatedState = await Effect.runPromise(readState(testDir, projectId))
      expect(updatedState.currentPhase).toBe("research_interview")
    })

    test("plan.md triggers phase transition from plan to plan_interview", async () => {
      const state = createTestState("plan")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(saveArtifact(testDir, projectId, "plan.md", "# Plan"))

      expect(result.success).toBe(true)
      expect(result.phaseTransitioned).toBe("plan_interview")

      const updatedState = await Effect.runPromise(readState(testDir, projectId))
      expect(updatedState.currentPhase).toBe("plan_interview")
    })

    test("arbitrary artifact does not trigger phase transition", async () => {
      const state = createTestState("execute")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await Effect.runPromise(saveArtifact(testDir, projectId, "notes.md", "# Notes"))

      expect(result.success).toBe(true)
      expect(result.phaseTransitioned).toBeUndefined()

      const updatedState = await Effect.runPromise(readState(testDir, projectId))
      expect(updatedState.currentPhase).toBe("execute")
    })
  })

  describe("saveArtifactAsync", () => {
    test("async wrapper works correctly", async () => {
      const state = createTestState("execute")
      await Effect.runPromise(writeState(testDir, projectId, state))

      const result = await saveArtifactAsync(testDir, projectId, "readme.md", "# README")

      expect(result.success).toBe(true)
      expect(result.artifact).toBe("readme.md")
    })
  })
})
