import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { execSync } from "node:child_process"
import { createLoopController, type LoopContext, type LoopController } from "../../src/loop/controller.js"
import type { LoopStatus } from "../../src/state/types.js"

function mockContext(workdir: string): LoopContext {
  const toastMessages: Array<{ message: string; variant?: string; title?: string }> = []
  const logMessages: Array<{ message: string; level?: string }> = []
  
  const mockClient = {
    session: {
      create: mock().mockResolvedValue({
        data: { sessionID: "test-session-id" }
      }),
      status: mock().mockResolvedValue({
        data: { status: "idle" }
      })
    }
  }

  return {
    workdir,
    client: mockClient,
    model: "test-model",
    showToast: async (message: string, variant?: "info" | "success" | "warning" | "error", title?: string) => {
      toastMessages.push({ message, variant, title })
    },
    log: async (message: string, level?: "info" | "warn" | "error" | "debug") => {
      logMessages.push({ message, level })
    }
  }
}

describe("loop controller", () => {
  let testDir: string
  let gitRepo: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-controller-test-"))
    
    // Create git repo
    gitRepo = path.join(testDir, "repo")
    await fs.mkdir(gitRepo)
    execSync("git init", { cwd: gitRepo, stdio: "ignore" })
    execSync("git config user.name Test", { cwd: gitRepo, stdio: "ignore" })
    execSync("git config user.email test@example.com", { cwd: gitRepo, stdio: "ignore" })
    
    // Initial commit
    await fs.writeFile(path.join(gitRepo, "README.md"), "# Test")
    execSync("git add README.md", { cwd: gitRepo, stdio: "ignore" })
    execSync('git commit -m "Initial commit"', { cwd: gitRepo, stdio: "ignore" })

    // Create .globex directory structure with default project
    const globexDir = path.join(gitRepo, ".globex")
    const projectsDir = path.join(globexDir, "projects") 
    const defaultProjectDir = path.join(projectsDir, "default")
    await fs.mkdir(defaultProjectDir, { recursive: true })

    // Create active-project file pointing to default
    await fs.writeFile(path.join(globexDir, "active-project"), "default")

    // Create minimal globex state.json in default project
    const globexState = {
      currentPhase: "execute",
      projectName: "Test Project",
      description: "Test description", 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvals: {},
      artifacts: {},
      interviewHistory: {}
    }
    await fs.writeFile(path.join(defaultProjectDir, "state.json"), JSON.stringify(globexState, null, 2))

    // Create minimal features.json
    const featuresContent = {
      features: [
        {
          id: "test-feature",
          description: "Test feature",
          priority: 1,
          passes: false,
          blocked: false,
          dependencies: [],
          acceptanceCriteria: ["Should work"],
          attempts: 0
        }
      ]
    }
    await fs.writeFile(path.join(defaultProjectDir, "features.json"), JSON.stringify(featuresContent, null, 2))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("createLoopController", () => {
    test("creates controller with all methods", () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      expect(controller).toHaveProperty("start")
      expect(controller).toHaveProperty("pause")
      expect(controller).toHaveProperty("resume")
      expect(controller).toHaveProperty("status")
      expect(typeof controller.start).toBe("function")
      expect(typeof controller.pause).toBe("function")
      expect(typeof controller.resume).toBe("function")
      expect(typeof controller.status).toBe("function")
    })
  })

  describe("start", () => {
    test("initializes state with correct defaults", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      // Mock session to complete immediately
      ctx.client.session.create.mockResolvedValue({ data: { sessionID: "ralph-session" } })
      ctx.client.session.status.mockResolvedValue({ data: { status: "idle" } })
      
      // Create done signal file so Ralph completes
      await fs.writeFile(path.join(gitRepo, ".globex-done"), "")
      
      // Create approved signal file so Wiggum approves
      await fs.writeFile(path.join(gitRepo, ".globex-approved"), "")
      
      await controller.start(1) // Just 1 iteration
      
      // Check that state was initialized and saved
      const stateFile = path.join(gitRepo, ".globex", "projects", "default", "loop-state.json")
      const stateExists = await fs.access(stateFile).then(() => true).catch(() => false)
      expect(stateExists).toBe(true)
      
      if (stateExists) {
        const stateContent = await fs.readFile(stateFile, "utf-8")
        const state = JSON.parse(stateContent)
        expect(state.status).toBeDefined()
        expect(state.iteration).toBeDefined()
        expect(state.totalIterations).toBe(1)
        expect(state.startedAt).toBeDefined()
      }
    })

    test("respects maxIterations parameter", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      await controller.start(3)
      
      const stateFile = path.join(gitRepo, ".globex", "projects", "default", "loop-state.json") 
      const stateContent = await fs.readFile(stateFile, "utf-8")
      const state = JSON.parse(stateContent)
      expect(state.totalIterations).toBe(3)
    })
  })

  describe("pause", () => {
    test("creates pause signal file", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      await controller.pause()
      
      const pauseFile = path.join(gitRepo, ".globex-pause")
      const pauseExists = await fs.access(pauseFile).then(() => true).catch(() => false)
      expect(pauseExists).toBe(true)
    })

    test("updates state when currently running", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      // First ensure the active project is set up properly
      await fs.writeFile(path.join(gitRepo, ".globex", "active-project"), "default")
      
      // Create running state
      const stateDir = path.join(gitRepo, ".globex", "projects", "default")
      await fs.mkdir(stateDir, { recursive: true })
      const runningState = {
        status: "running",
        iteration: 0,
        totalIterations: 10,
        startedAt: new Date().toISOString(),
        currentFeatureId: undefined,
        lastCommitHash: undefined,
        pausedAt: undefined,
        ralphSessionId: undefined,
        wiggumSessionId: undefined,
        lastSignal: undefined,
        completedFeatures: [],
        blockedFeatures: []
      }
      await fs.writeFile(path.join(stateDir, "loop-state.json"), JSON.stringify(runningState))
      
      await controller.pause()
      
      const stateContent = await fs.readFile(path.join(stateDir, "loop-state.json"), "utf-8")
      const state = JSON.parse(stateContent)
      expect(state.status).toBe("paused")
      expect(state.pausedAt).toBeDefined()
    })
  })

  describe("resume", () => {
    test("removes pause signal file", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      // Create pause file first
      const pauseFile = path.join(gitRepo, ".globex-pause")
      await fs.writeFile(pauseFile, "test")
      
      await controller.resume()
      
      const pauseExists = await fs.access(pauseFile).then(() => true).catch(() => false)
      expect(pauseExists).toBe(false)
    })

    test("handles missing pause file gracefully", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      // Should not throw when pause file doesn't exist
      expect(async () => await controller.resume()).not.toThrow()
    })

    test("updates paused state to running", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      // Set up active project
      await fs.writeFile(path.join(gitRepo, ".globex", "active-project"), "default")
      
      // Create paused state with all required fields
      const stateDir = path.join(gitRepo, ".globex", "projects", "default")
      await fs.mkdir(stateDir, { recursive: true })
      const pausedState = {
        status: "paused",
        iteration: 2,
        totalIterations: 10,
        startedAt: new Date().toISOString(),
        pausedAt: new Date().toISOString(),
        currentFeatureId: undefined,
        lastCommitHash: undefined,
        ralphSessionId: undefined,
        wiggumSessionId: undefined,
        lastSignal: undefined,
        completedFeatures: [],
        blockedFeatures: []
      }
      await fs.writeFile(path.join(stateDir, "loop-state.json"), JSON.stringify(pausedState))
      
      // Mock sessions to avoid infinite loops
      ctx.client.session.create.mockResolvedValue({ data: { sessionID: "test-session" } })
      ctx.client.session.status.mockResolvedValue({ data: { status: "idle" } })
      
      // Create signal files so loop completes quickly
      await fs.writeFile(path.join(gitRepo, ".globex-done"), "")
      await fs.writeFile(path.join(gitRepo, ".globex-approved"), "")
      
      await controller.resume()
      
      const stateContent = await fs.readFile(path.join(stateDir, "loop-state.json"), "utf-8")
      const state = JSON.parse(stateContent)
      // Status could be "complete" if feature passed, or "running" depending on timing
      expect(["running", "complete"].includes(state.status)).toBe(true)
      expect(state.pausedAt).toBeUndefined()
    })
  })

  describe("status", () => {
    test("returns idle when no state exists", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      const status = await controller.status()
      expect(status).toBe("idle")
    })

    test("returns current state status", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      // Set up active project
      await fs.writeFile(path.join(gitRepo, ".globex", "active-project"), "default")
      
      // Create running state
      const stateDir = path.join(gitRepo, ".globex", "projects", "default")
      await fs.mkdir(stateDir, { recursive: true })
      const runningState = {
        status: "running",
        iteration: 0,
        totalIterations: 10,
        currentFeatureId: undefined,
        lastCommitHash: undefined,
        startedAt: undefined,
        pausedAt: undefined,
        ralphSessionId: undefined,
        wiggumSessionId: undefined,
        lastSignal: undefined,
        completedFeatures: [],
        blockedFeatures: []
      }
      await fs.writeFile(path.join(stateDir, "loop-state.json"), JSON.stringify(runningState))
      
      const status = await controller.status()
      expect(status).toBe("running")
    })

    test("syncs status with pause signal file", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      // Set up active project
      await fs.writeFile(path.join(gitRepo, ".globex", "active-project"), "default")
      
      // Create running state but also pause file
      const stateDir = path.join(gitRepo, ".globex", "projects", "default")
      await fs.mkdir(stateDir, { recursive: true })
      const runningState = {
        status: "running",
        iteration: 0,
        totalIterations: 10,
        currentFeatureId: undefined,
        lastCommitHash: undefined,
        startedAt: undefined,
        pausedAt: undefined,
        ralphSessionId: undefined,
        wiggumSessionId: undefined,
        lastSignal: undefined,
        completedFeatures: [],
        blockedFeatures: []
      }
      await fs.writeFile(path.join(stateDir, "loop-state.json"), JSON.stringify(runningState))
      await fs.writeFile(path.join(gitRepo, ".globex-pause"), "")
      
      const status = await controller.status()
      expect(status).toBe("paused")
      
      // Verify state was updated
      const stateContent = await fs.readFile(path.join(stateDir, "loop-state.json"), "utf-8")
      const state = JSON.parse(stateContent)
      expect(state.status).toBe("paused")
      expect(state.pausedAt).toBeDefined()
    })
  })

  describe("state transitions", () => {
    test("idle → paused → resumed", async () => {
      const ctx = mockContext(gitRepo)
      const controller = createLoopController(ctx)
      
      // Initial status should be idle
      expect(await controller.status()).toBe("idle")
      
      // Pause should create pause signal 
      await controller.pause()
      const pauseFile = path.join(gitRepo, ".globex-pause")
      const pauseExists = await fs.access(pauseFile).then(() => true).catch(() => false)
      expect(pauseExists).toBe(true)
      
      // Resume should remove signal
      await controller.resume()
      const pauseExistsAfter = await fs.access(pauseFile).then(() => true).catch(() => false)
      expect(pauseExistsAfter).toBe(false)
    })
  })
})