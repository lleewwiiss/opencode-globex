import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Effect, Exit } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import {
  readState,
  writeState,
  getProjectDir,
} from "../../src/state/persistence.js"
import type { GlobexState } from "../../src/state/types.js"

const createTestState = (projectName: string, description: string): GlobexState => ({
  projectName,
  description,
  currentPhase: "init",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  approvals: {},
  artifacts: {},
  interviewHistory: {},
})

describe("cli/state/persistence", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-cli-test-"))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("writeState / readState", () => {
    test("write then read returns same state", async () => {
      const state = createTestState("my-project", "My description")
      const projectId = "test-project-id"

      await Effect.runPromise(writeState(testDir, projectId, state))
      const read = await Effect.runPromise(readState(testDir, projectId))

      expect(read.projectName).toBe("my-project")
      expect(read.description).toBe("My description")
      expect(read.currentPhase).toBe("init")
    })

    test("creates directories if missing", async () => {
      const state = createTestState("test", "desc")
      const projectId = "new-project"

      await Effect.runPromise(writeState(testDir, projectId, state))

      const projectDir = getProjectDir(testDir, projectId)
      const stat = await fs.stat(projectDir)
      expect(stat.isDirectory()).toBe(true)
    })

    test("handles StateNotFoundError on missing file", async () => {
      const projectId = "nonexistent"

      const result = await Effect.runPromiseExit(readState(testDir, projectId))

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause
        expect(error._tag).toBe("Fail")
      }
    })
  })
})
