import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { getGlobexDir } from "../../src/state/persistence"

/**
 * Integration tests for the Ralph-Wiggum tool cycle:
 * get_next_feature -> update_feature -> update_progress
 * 
 * Uses temp directories copied from mock-project fixture.
 * Tests clean up after themselves.
 */

describe("ralph-wiggum integration", () => {
  let testDir: string
  const fixtureDir = path.join(__dirname, "mock-project")

  beforeEach(async () => {
    // Create temp dir and copy fixture
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-ralph-test-"))
    await copyDir(fixtureDir, testDir)
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("full tool cycle", () => {
    test("get_next_feature returns first eligible feature", async () => {
      const { createGetNextFeature } = await import("../../src/tools/get-next-feature")
      const tool = createGetNextFeature(testDir)

      const result = await tool.execute({}, mockContext())
      const parsed = JSON.parse(result)

      // MOCK-001 and MOCK-003 have no deps; MOCK-001 is priority 1
      expect(parsed.feature).toBeDefined()
      expect(parsed.feature.id).toBe("MOCK-001")
      expect(parsed.progress.completed).toBe(0)
      expect(parsed.progress.remaining).toBe(3)
      expect(parsed.progress.total).toBe(3)
    })

    test("get_next_feature skips features with unmet deps", async () => {
      const { createGetNextFeature } = await import("../../src/tools/get-next-feature")
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      
      const getNext = createGetNextFeature(testDir)
      const update = createUpdateFeature(testDir)

      // Complete MOCK-003 (no deps, priority 3)
      await update.execute({ featureId: "MOCK-003", passes: true }, mockContext())
      
      // Next should still be MOCK-001 (priority 1, no deps)
      const result = await getNext.execute({}, mockContext())
      const parsed = JSON.parse(result)

      expect(parsed.feature.id).toBe("MOCK-001")
    })

    test("update_feature marks feature complete", async () => {
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      const tool = createUpdateFeature(testDir)

      const result = await tool.execute(
        { featureId: "MOCK-001", passes: true, notes: "Implemented greeting" },
        mockContext()
      )
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.featureId).toBe("MOCK-001")
      expect(parsed.passes).toBe(true)
      expect(parsed.progress).toContain("1/3")

      // Verify persisted
      const featuresPath = path.join(getGlobexDir(testDir), "features.json")
      const features = JSON.parse(await fs.readFile(featuresPath, "utf-8"))
      const f001 = features.features.find((f: any) => f.id === "MOCK-001")
      expect(f001.passes).toBe(true)
      expect(f001.notes).toBe("Implemented greeting")
    })

    test("update_feature unblocks dependent features", async () => {
      const { createGetNextFeature } = await import("../../src/tools/get-next-feature")
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      
      const getNext = createGetNextFeature(testDir)
      const update = createUpdateFeature(testDir)

      // MOCK-002 depends on MOCK-001
      // Before: MOCK-002 should not be next
      let result = await getNext.execute({}, mockContext())
      let parsed = JSON.parse(result)
      expect(parsed.feature.id).toBe("MOCK-001") // or MOCK-003, both have no deps

      // Complete MOCK-001
      await update.execute({ featureId: "MOCK-001", passes: true }, mockContext())

      // Complete MOCK-003 to isolate test
      await update.execute({ featureId: "MOCK-003", passes: true }, mockContext())

      // Now MOCK-002 should be next (deps satisfied)
      result = await getNext.execute({}, mockContext())
      parsed = JSON.parse(result)
      expect(parsed.feature.id).toBe("MOCK-002")
    })

    test("update_progress generates progress.md", async () => {
      const { createUpdateProgress } = await import("../../src/tools/update-progress")
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      
      const progress = createUpdateProgress(testDir)
      const update = createUpdateFeature(testDir)

      // Complete a feature
      await update.execute({ featureId: "MOCK-001", passes: true }, mockContext())

      // Update progress
      const result = await progress.execute(
        { currentFeatureId: "MOCK-002", incrementIteration: true },
        mockContext()
      )
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.iteration).toBe(2) // incremented from 1

      // Verify progress.md content
      const progressPath = path.join(getGlobexDir(testDir), "progress.md")
      const content = await fs.readFile(progressPath, "utf-8")
      
      expect(content).toContain("# Progress")
      expect(content).toContain("MOCK-002") // current feature
      expect(content).toContain("[x] MOCK-001") // completed
      expect(content).toContain("[ ] MOCK-002") // remaining
    })

    test("full cycle: get -> update -> progress -> get returns next", async () => {
      const { createGetNextFeature } = await import("../../src/tools/get-next-feature")
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      const { createUpdateProgress } = await import("../../src/tools/update-progress")
      
      const getNext = createGetNextFeature(testDir)
      const update = createUpdateFeature(testDir)
      const progress = createUpdateProgress(testDir)

      // Iteration 1: get next feature
      let result = await getNext.execute({}, mockContext())
      let parsed = JSON.parse(result)
      const firstFeature = parsed.feature.id
      expect(["MOCK-001", "MOCK-003"]).toContain(firstFeature) // either no-dep feature

      // Mark complete
      await update.execute({ featureId: firstFeature, passes: true }, mockContext())

      // Update progress
      await progress.execute({ incrementIteration: true }, mockContext())

      // Iteration 2: get next
      result = await getNext.execute({}, mockContext())
      parsed = JSON.parse(result)
      expect(parsed.feature).toBeDefined()
      expect(parsed.feature.id).not.toBe(firstFeature)
      expect(parsed.progress.completed).toBe(1)
      expect(parsed.progress.remaining).toBe(2)
    })

    test("returns done when all features complete", async () => {
      const { createGetNextFeature } = await import("../../src/tools/get-next-feature")
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      
      const getNext = createGetNextFeature(testDir)
      const update = createUpdateFeature(testDir)

      // Complete all features in dependency order
      await update.execute({ featureId: "MOCK-001", passes: true }, mockContext())
      await update.execute({ featureId: "MOCK-003", passes: true }, mockContext())
      await update.execute({ featureId: "MOCK-002", passes: true }, mockContext())

      // Should return done
      const result = await getNext.execute({}, mockContext())
      const parsed = JSON.parse(result)

      expect(parsed.done).toBe(true)
      expect(parsed.totalFeatures).toBe(3)
    })

    test("blocked feature returns blocked state", async () => {
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      const tool = createUpdateFeature(testDir)

      const result = await tool.execute(
        { featureId: "MOCK-001", blocked: true, blockedReason: "External API unavailable" },
        mockContext()
      )
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.blocked).toBe(true)

      // Verify persisted
      const featuresPath = path.join(getGlobexDir(testDir), "features.json")
      const features = JSON.parse(await fs.readFile(featuresPath, "utf-8"))
      const f001 = features.features.find((f: any) => f.id === "MOCK-001")
      expect(f001.blocked).toBe(true)
      expect(f001.blockedReason).toBe("External API unavailable")
    })

    test("blocked features tracked in progress", async () => {
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      const { createUpdateProgress } = await import("../../src/tools/update-progress")
      
      const update = createUpdateFeature(testDir)
      const progress = createUpdateProgress(testDir)

      // Block a feature
      await update.execute(
        { featureId: "MOCK-001", blocked: true, blockedReason: "Needs clarification" },
        mockContext()
      )

      // Update progress with blocked info
      await progress.execute(
        { 
          blockedFeatures: [{ featureId: "MOCK-001", reason: "Needs clarification" }]
        },
        mockContext()
      )

      // Verify progress.md shows blocked
      const progressPath = path.join(getGlobexDir(testDir), "progress.md")
      const content = await fs.readFile(progressPath, "utf-8")
      
      expect(content).toContain("Blocked")
      expect(content).toContain("MOCK-001")
    })
  })

  describe("learning integration", () => {
    test("update_progress with learning adds to progress.md", async () => {
      const { createUpdateProgress } = await import("../../src/tools/update-progress")
      const progress = createUpdateProgress(testDir)

      await progress.execute(
        { learning: "Mock project requires special config" },
        mockContext()
      )

      const progressPath = path.join(getGlobexDir(testDir), "progress.md")
      const content = await fs.readFile(progressPath, "utf-8")
      
      expect(content).toContain("Recent Feedback")
      expect(content).toContain("Mock project requires special config")
    })
  })

  describe("error handling", () => {
    test("update_feature rejects invalid feature id", async () => {
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      const tool = createUpdateFeature(testDir)

      const result = await tool.execute(
        { featureId: "NONEXISTENT", passes: true },
        mockContext()
      )
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain("not found")
    })

    test("get_next_feature handles missing features.json", async () => {
      // Remove features.json
      await fs.rm(path.join(getGlobexDir(testDir), "features.json"))

      const { createGetNextFeature } = await import("../../src/tools/get-next-feature")
      const tool = createGetNextFeature(testDir)

      const result = await tool.execute({}, mockContext())
      const parsed = JSON.parse(result)

      expect(parsed.error).toBeDefined()
    })

    test("circular dependencies return blocked state", async () => {
      // Modify fixture to have circular deps
      const featuresPath = path.join(getGlobexDir(testDir), "features.json")
      const features = JSON.parse(await fs.readFile(featuresPath, "utf-8"))
      
      // Make MOCK-001 depend on MOCK-002, creating cycle
      features.features[0].dependencies = ["MOCK-002"]
      await fs.writeFile(featuresPath, JSON.stringify(features, null, 2))

      const { createGetNextFeature } = await import("../../src/tools/get-next-feature")
      const tool = createGetNextFeature(testDir)

      const result = await tool.execute({}, mockContext())
      const parsed = JSON.parse(result)

      // Should still return MOCK-003 (no deps)
      // MOCK-001 and MOCK-002 are mutually blocked
      if (parsed.feature) {
        expect(parsed.feature.id).toBe("MOCK-003")
      } else {
        // Or returns blocked if only checking first eligible
        expect(parsed.blocked).toBe(true)
      }
    })
  })

  describe("isolation", () => {
    test("tests use isolated temp directories", async () => {
      // Verify we're in temp, not polluting fixture
      expect(testDir).toContain(os.tmpdir())
      expect(testDir).not.toContain("mock-project")
    })

    test("fixture remains unchanged after test", async () => {
      const { createUpdateFeature } = await import("../../src/tools/update-feature")
      const tool = createUpdateFeature(testDir)

      // Modify temp copy
      await tool.execute({ featureId: "MOCK-001", passes: true }, mockContext())

      // Verify fixture unchanged
      const fixturePath = path.join(fixtureDir, ".globex/features.json")
      const fixture = JSON.parse(await fs.readFile(fixturePath, "utf-8"))
      const f001 = fixture.features.find((f: any) => f.id === "MOCK-001")
      
      expect(f001.passes).toBe(false) // Original unchanged
    })
  })
})

function mockContext() {
  return {
    sessionID: "integration-test-session",
    messageID: "integration-test-message",
    agent: "integration-test-agent",
    abort: new AbortController().signal,
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}
