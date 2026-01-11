import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import * as registryModule from "../../src/state/registry.js"
import type { RegistryEntry } from "../../src/state/registry.js"

const createTestEntry = (overrides?: Partial<RegistryEntry>): RegistryEntry => ({
  name: "test-project",
  repoPath: "/path/to/repo",
  phase: "init",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe("cli/state/registry", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-registry-test-"))
    // Mock HOME to isolate registry file
    spyOn(os, "homedir").mockReturnValue(testDir)
  })

  afterEach(async () => {
    // Restore original homedir
    spyOn(os, "homedir").mockRestore()
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("loadRegistry", () => {
    test("returns empty projects when no file exists", async () => {
      const registry = await registryModule.loadRegistry()
      expect(registry.projects).toEqual({})
    })

    test("reads existing registry file", async () => {
      const registryPath = path.join(testDir, ".globex", "registry.json")
      await fs.mkdir(path.dirname(registryPath), { recursive: true })
      await fs.writeFile(
        registryPath,
        JSON.stringify({
          projects: {
            "project-1": createTestEntry({ name: "project-1" }),
          },
        })
      )

      const registry = await registryModule.loadRegistry()
      expect(registry.projects["project-1"]).toBeDefined()
      expect(registry.projects["project-1"].name).toBe("project-1")
    })
  })

  describe("upsertProject", () => {
    test("creates registry file when none exists", async () => {
      const entry = createTestEntry({ name: "new-project" })

      await registryModule.upsertProject("proj-123", entry)

      const registryPath = path.join(testDir, ".globex", "registry.json")
      const exists = await fs.stat(registryPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)

      const content = await fs.readFile(registryPath, "utf-8")
      const registry = JSON.parse(content)
      expect(registry.projects["proj-123"]).toBeDefined()
      expect(registry.projects["proj-123"].name).toBe("new-project")
    })

    test("updates existing project entry", async () => {
      const entry1 = createTestEntry({ name: "original", phase: "init" })
      const entry2 = createTestEntry({ name: "updated", phase: "plan" })

      await registryModule.upsertProject("proj-123", entry1)
      await registryModule.upsertProject("proj-123", entry2)

      const registry = await registryModule.loadRegistry()
      expect(registry.projects["proj-123"].name).toBe("updated")
      expect(registry.projects["proj-123"].phase).toBe("plan")
    })

    test("adds multiple projects", async () => {
      await registryModule.upsertProject("proj-1", createTestEntry({ name: "first" }))
      await registryModule.upsertProject("proj-2", createTestEntry({ name: "second" }))

      const registry = await registryModule.loadRegistry()
      expect(Object.keys(registry.projects)).toHaveLength(2)
      expect(registry.projects["proj-1"].name).toBe("first")
      expect(registry.projects["proj-2"].name).toBe("second")
    })
  })

  describe("removeProject", () => {
    test("removes entry from registry", async () => {
      await registryModule.upsertProject("proj-1", createTestEntry({ name: "first" }))
      await registryModule.upsertProject("proj-2", createTestEntry({ name: "second" }))

      await registryModule.removeProject("proj-1")

      const registry = await registryModule.loadRegistry()
      expect(registry.projects["proj-1"]).toBeUndefined()
      expect(registry.projects["proj-2"]).toBeDefined()
    })

    test("handles removing non-existent project gracefully", async () => {
      await registryModule.upsertProject("proj-1", createTestEntry())

      // Should not throw
      await registryModule.removeProject("nonexistent")

      const registry = await registryModule.loadRegistry()
      expect(registry.projects["proj-1"]).toBeDefined()
    })
  })

  describe("getProject", () => {
    test("returns undefined for non-existent project", async () => {
      const result = await registryModule.getProject("nonexistent")
      expect(result).toBeUndefined()
    })

    test("returns entry for existing project", async () => {
      const entry = createTestEntry({ name: "my-project", repoPath: "/my/repo" })
      await registryModule.upsertProject("proj-123", entry)

      const result = await registryModule.getProject("proj-123")
      expect(result).toBeDefined()
      expect(result?.name).toBe("my-project")
      expect(result?.repoPath).toBe("/my/repo")
    })
  })
})
