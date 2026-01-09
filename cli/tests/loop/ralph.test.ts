import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import {
  runRalphLoop,
  type RalphLoopContext,
  type RalphLoopCallbacks,
} from "../../src/loop/ralph.js"
import * as signals from "../../src/loop/signals.js"
import * as git from "../../src/git.js"
import type { Feature } from "../../src/state/schema.js"

// Mock callbacks factory
const createMockCallbacks = (): RalphLoopCallbacks => ({
  onIterationStart: mock(() => {}),
  onIterationComplete: mock(() => {}),
  onRalphStart: mock(() => {}),
  onRalphComplete: mock(() => {}),
  onWiggumStart: mock(() => {}),
  onWiggumComplete: mock(() => {}),
  onFeatureComplete: mock(() => {}),
  onFeatureRetry: mock(() => {}),
  onFeatureBlocked: mock(() => {}),
  onPaused: mock(() => {}),
  onResumed: mock(() => {}),
  onComplete: mock(() => {}),
  onError: mock(() => {}),
  onCommitsUpdated: mock(() => {}),
  onDiffUpdated: mock(() => {}),
})

// Create async generator that simulates SSE event stream
async function* createMockEventStream(sessionId: string) {
  yield { type: "server.connected" }
  await new Promise((r) => setTimeout(r, 10))
  yield {
    type: "session.idle",
    properties: { sessionID: sessionId },
  }
}

// Mock OpenCode client factory
const createMockClient = () => {
  const sessionId = "session-123"
  return {
    session: {
      create: mock(() => Promise.resolve({ data: { id: sessionId } })),
      prompt: mock(() => Promise.resolve({ data: {} })),
    },
    event: {
      subscribe: mock(() =>
        Promise.resolve({
          stream: createMockEventStream(sessionId),
        })
      ),
    },
  }
}

// Sample feature factory
const createTestFeature = (overrides?: Partial<Feature>): Feature => ({
  id: "test-feature",
  description: "Test feature description",
  priority: 1,
  passes: false,
  dependencies: [],
  acceptanceCriteria: ["Criterion 1"],
  filesTouched: ["src/test.ts"],
  patternsToFollow: [],
  ...overrides,
})

describe("cli/loop/ralph", () => {
  let testDir: string
  let projectDir: string
  let projectId: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-ralph-test-"))
    projectId = "test-project"
    projectDir = path.join(testDir, ".globex", "projects", projectId)
    await fs.mkdir(projectDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  async function writeFeaturesJson(features: Feature[]) {
    await fs.writeFile(
      path.join(projectDir, "features.json"),
      JSON.stringify({ features }, null, 2)
    )
  }

  async function readFeaturesJson(): Promise<Feature[]> {
    const content = await fs.readFile(
      path.join(projectDir, "features.json"),
      "utf-8"
    )
    return JSON.parse(content).features
  }

  describe("happy path - feature approved", () => {
    test("commits changes and sets passes=true on approval", async () => {
      const feature = createTestFeature()
      await writeFeaturesJson([feature])

      const client = createMockClient()
      const callbacks = createMockCallbacks()

      // Mock signals
      const checkSignalSpy = spyOn(signals, "checkSignal").mockImplementation(
        async (_workdir: string, type: signals.SignalType) => {
          if (type === "done") return true
          if (type === "approved") return true
          if (type === "rejected") return false
          if (type === "pause") return false
          return false
        }
      )
      const clearSpy = spyOn(signals, "clearSignals").mockResolvedValue()

      // Mock git functions
      spyOn(git, "getHeadHash").mockResolvedValue("abc123")
      spyOn(git, "getCommitsSince").mockResolvedValue([])
      spyOn(git, "getDiffStatsSince").mockResolvedValue({ added: 0, removed: 0 })
      const commitSpy = spyOn(git, "commitChanges").mockResolvedValue(
        "abc123def"
      )

      const ctx: RalphLoopContext = {
        client: client as any,
        workdir: testDir,
        projectId,
        model: "anthropic/claude-sonnet-4",
      }

      const result = await runRalphLoop(ctx, callbacks)

      expect(result.success).toBe(true)
      expect(result.completedFeatures).toContain("test-feature")

      // Verify commit was called
      expect(commitSpy).toHaveBeenCalledWith(
        testDir,
        "feat(test-feature): implement feature"
      )

      // Verify feature updated
      const features = await readFeaturesJson()
      expect(features[0].passes).toBe(true)

      // Verify callbacks
      expect(callbacks.onFeatureComplete).toHaveBeenCalledWith("test-feature")
      expect(callbacks.onComplete).toHaveBeenCalledWith(1, 1)

      // Cleanup spies
      checkSignalSpy.mockRestore()
      clearSpy.mockRestore()
      commitSpy.mockRestore()
    })

    test("completes all features and calls onComplete when all passed", async () => {
      const feature = createTestFeature({ passes: true })
      await writeFeaturesJson([feature])

      const client = createMockClient()
      const callbacks = createMockCallbacks()

      // Mock git functions
      spyOn(git, "getHeadHash").mockResolvedValue("abc123")

      const ctx: RalphLoopContext = {
        client: client as any,
        workdir: testDir,
        projectId,
        model: "anthropic/claude-sonnet-4",
      }

      const result = await runRalphLoop(ctx, callbacks)

      expect(result.success).toBe(true)
      expect(callbacks.onComplete).toHaveBeenCalledWith(1, 1)
    })
  })

  describe("rejection retry flow", () => {
    test("increments attempts on rejection", async () => {
      const feature = createTestFeature({ attempts: 0 })
      await writeFeaturesJson([feature])

      const client = createMockClient()
      const callbacks = createMockCallbacks()

      // Track iterations to abort after first rejection
      let iterationCount = 0
      const abortController = new AbortController()

      // Mock signals
      const checkSignalSpy = spyOn(signals, "checkSignal").mockImplementation(
        async (_workdir: string, type: signals.SignalType) => {
          if (type === "pause") return false
          if (type === "done") return true
          if (type === "approved") return false
          if (type === "rejected") return true
          return false
        }
      )
      const clearSpy = spyOn(signals, "clearSignals").mockResolvedValue()

      // Mock git functions
      spyOn(git, "getHeadHash").mockResolvedValue("abc123")
      spyOn(git, "getCommitsSince").mockResolvedValue([])
      spyOn(git, "getDiffStatsSince").mockResolvedValue({ added: 0, removed: 0 })

      // Write rejection info
      await fs.writeFile(
        path.join(testDir, ".globex-rejected"),
        JSON.stringify({
          featureId: "test-feature",
          reasons: ["Test failed"],
        })
      )

      // Abort after first retry callback
      callbacks.onFeatureRetry = mock(() => {
        iterationCount++
        if (iterationCount >= 1) {
          abortController.abort()
        }
      })

      const ctx: RalphLoopContext = {
        client: client as any,
        workdir: testDir,
        projectId,
        model: "anthropic/claude-sonnet-4",
      }

      await runRalphLoop(ctx, callbacks, abortController.signal)

      // Verify attempts incremented
      const features = await readFeaturesJson()
      expect(features[0].attempts).toBe(1)
      expect(features[0].passes).toBe(false)
      expect(callbacks.onFeatureRetry).toHaveBeenCalled()

      checkSignalSpy.mockRestore()
      clearSpy.mockRestore()
    })
  })

  describe("max attempts blocking", () => {
    test("blocks feature after MAX_ATTEMPTS exceeded", async () => {
      const feature = createTestFeature({ attempts: 3 }) // Already at max
      await writeFeaturesJson([feature])

      const client = createMockClient()
      const callbacks = createMockCallbacks()

      // Mock git functions
      spyOn(git, "getHeadHash").mockResolvedValue("abc123")

      const ctx: RalphLoopContext = {
        client: client as any,
        workdir: testDir,
        projectId,
        model: "anthropic/claude-sonnet-4",
      }

      const result = await runRalphLoop(ctx, callbacks)

      expect(result.success).toBe(true) // Loop completes (no more eligible)
      expect(result.blockedFeatures).toContain("test-feature")

      // Verify feature blocked
      const features = await readFeaturesJson()
      const blocked = features[0] as Feature & {
        blocked?: boolean
        blockedReason?: string
      }
      expect(blocked.blocked).toBe(true)
      expect(blocked.blockedReason).toContain("Max attempts")

      expect(callbacks.onFeatureBlocked).toHaveBeenCalledWith(
        "test-feature",
        expect.stringContaining("Max attempts")
      )
    })
  })

  describe("pause/resume behavior", () => {
    test("detects pause file and calls onPaused callback", async () => {
      const feature = createTestFeature()
      await writeFeaturesJson([feature])

      const client = createMockClient()
      const callbacks = createMockCallbacks()
      const abortController = new AbortController()

      // Mock git functions
      spyOn(git, "getHeadHash").mockResolvedValue("abc123")

      // Create pause file before starting
      await fs.writeFile(path.join(testDir, ".globex-pause"), "")

      // Abort after pause callback
      callbacks.onPaused = mock(() => {
        // Schedule abort to allow resume check
        setTimeout(() => abortController.abort(), 50)
      })

      const ctx: RalphLoopContext = {
        client: client as any,
        workdir: testDir,
        projectId,
        model: "anthropic/claude-sonnet-4",
      }

      await runRalphLoop(ctx, callbacks, abortController.signal)

      expect(callbacks.onPaused).toHaveBeenCalled()
    })

    test("resumes when pause file removed", async () => {
      const feature = createTestFeature({ passes: true }) // Already complete
      await writeFeaturesJson([feature])

      const client = createMockClient()
      const callbacks = createMockCallbacks()

      // Mock git functions
      spyOn(git, "getHeadHash").mockResolvedValue("abc123")

      // Create then immediately remove pause file
      await fs.writeFile(path.join(testDir, ".globex-pause"), "")

      const ctx: RalphLoopContext = {
        client: client as any,
        workdir: testDir,
        projectId,
        model: "anthropic/claude-sonnet-4",
      }

      // Remove pause file after onPaused
      let pausedCalled = false
      callbacks.onPaused = mock(() => {
        pausedCalled = true
        // Remove pause file to trigger resume
        fs.unlink(path.join(testDir, ".globex-pause"))
      })

      const result = await runRalphLoop(ctx, callbacks)

      // Should have paused and then resumed to completion
      expect(pausedCalled).toBe(true)
      expect(result.success).toBe(true)
    })
  })

  describe("abort signal", () => {
    test("returns aborted result when signal fires during session wait", async () => {
      const feature = createTestFeature()
      await writeFeaturesJson([feature])

      // Create a mock client that takes time to complete
      async function* slowEventStream(sessionId: string) {
        yield { type: "server.connected" }
        await new Promise((r) => setTimeout(r, 200))
        yield {
          type: "session.idle",
          properties: { sessionID: sessionId },
        }
      }

      const sessionId = "session-123"
      const client = {
        session: {
          create: mock(() => Promise.resolve({ data: { id: sessionId } })),
          prompt: mock(() => Promise.resolve({ data: {} })),
        },
        event: {
          subscribe: mock(() =>
            Promise.resolve({
              stream: slowEventStream(sessionId),
            })
          ),
        },
      }

      const callbacks = createMockCallbacks()
      const abortController = new AbortController()

      // Mock git functions
      spyOn(git, "getHeadHash").mockResolvedValue("abc123")
      const clearSpy = spyOn(signals, "clearSignals").mockResolvedValue()
      const checkSpy = spyOn(signals, "checkSignal").mockResolvedValue(false)

      const ctx: RalphLoopContext = {
        client: client as any,
        workdir: testDir,
        projectId,
        model: "anthropic/claude-sonnet-4",
      }

      // Abort during session
      setTimeout(() => abortController.abort(), 100)

      const result = await runRalphLoop(ctx, callbacks, abortController.signal)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Loop aborted")

      clearSpy.mockRestore()
      checkSpy.mockRestore()
    })
  })

  describe("error handling", () => {
    test("calls onError when Ralph times out", async () => {
      const feature = createTestFeature()
      await writeFeaturesJson([feature])

      // Create a mock client where event stream ends unexpectedly
      async function* emptyEventStream() {
        yield { type: "server.connected" }
        // Stream ends without session.idle
      }

      const sessionId = "session-123"
      const client = {
        session: {
          create: mock(() => Promise.resolve({ data: { id: sessionId } })),
          prompt: mock(() => Promise.resolve({ data: {} })),
        },
        event: {
          subscribe: mock(() =>
            Promise.resolve({
              stream: emptyEventStream(),
            })
          ),
        },
      }

      const callbacks = createMockCallbacks()
      const abortController = new AbortController()

      // Mock git functions
      spyOn(git, "getHeadHash").mockResolvedValue("abc123")
      const clearSpy = spyOn(signals, "clearSignals").mockResolvedValue()
      const checkSpy = spyOn(signals, "checkSignal").mockResolvedValue(false)

      // Abort after error
      callbacks.onError = mock(() => {
        abortController.abort()
      })

      const ctx: RalphLoopContext = {
        client: client as any,
        workdir: testDir,
        projectId,
        model: "anthropic/claude-sonnet-4",
      }

      await runRalphLoop(ctx, callbacks, abortController.signal)

      expect(callbacks.onError).toHaveBeenCalled()

      clearSpy.mockRestore()
      checkSpy.mockRestore()
    })

    test("calls onError when Wiggum has no approval/rejection marker", async () => {
      const feature = createTestFeature()
      await writeFeaturesJson([feature])

      const client = createMockClient()
      const callbacks = createMockCallbacks()
      const abortController = new AbortController()

      // Mock git functions
      spyOn(git, "getHeadHash").mockResolvedValue("abc123")
      const clearSpy = spyOn(signals, "clearSignals").mockResolvedValue()
      const checkSpy = spyOn(signals, "checkSignal").mockImplementation(
        async (_workdir: string, type: signals.SignalType) => {
          if (type === "done") return true
          return false // no approved, no rejected
        }
      )

      callbacks.onError = mock(() => {
        abortController.abort()
      })

      const ctx: RalphLoopContext = {
        client: client as any,
        workdir: testDir,
        projectId,
        model: "anthropic/claude-sonnet-4",
      }

      await runRalphLoop(ctx, callbacks, abortController.signal)

      expect(callbacks.onError).toHaveBeenCalled()

      clearSpy.mockRestore()
      checkSpy.mockRestore()
    })
  })
})
