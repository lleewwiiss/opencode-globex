import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { createLoopControl } from "../../src/tools/loop-control.js"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"

describe("loop-control", () => {
  let testDir: string
  let tool: ReturnType<typeof createLoopControl>

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-test-"))
    tool = createLoopControl(testDir)
    
    // Create .globex directory structure
    await fs.mkdir(path.join(testDir, ".globex"), { recursive: true })
    
    // Initialize basic state file
    const stateFile = path.join(testDir, ".globex", "state.json")
    await fs.writeFile(stateFile, JSON.stringify({
      projectId: "test-project",
      phase: "execute",
      features: { total: 1, completed: 0, remaining: 1 }
    }))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  test("start action returns success", async () => {
    const result = await tool.execute({ action: "start" }, mockContext())
    const parsed = JSON.parse(result)
    
    expect(parsed.success).toBe(true)
    expect(parsed.action).toBe("start")
    expect(parsed.maxIterations).toBe(50)
    expect(parsed.model).toBe("claude-3-5-sonnet-20241022")
  })

  test("start action with custom parameters", async () => {
    const result = await tool.execute({ 
      action: "start", 
      maxIterations: 10,
      model: "claude-3-5-haiku-20241022"
    }, mockContext())
    const parsed = JSON.parse(result)
    
    expect(parsed.success).toBe(true)
    expect(parsed.maxIterations).toBe(10)
    expect(parsed.model).toBe("claude-3-5-haiku-20241022")
  })

  test("pause action creates file", async () => {
    const result = await tool.execute({ action: "pause" }, mockContext())
    const parsed = JSON.parse(result)
    
    expect(parsed.success).toBe(true)
    expect(parsed.action).toBe("pause")
    expect(parsed.loopState).toBeDefined()
    
    // Check that pause file is created  
    const pauseFile = path.join(testDir, ".globex-pause")
    const exists = await fs.access(pauseFile).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })

  test("resume removes file", async () => {
    // First create pause file
    const pauseFile = path.join(testDir, ".globex-pause")
    await fs.writeFile(pauseFile, "")
    
    const result = await tool.execute({ action: "resume" }, mockContext())
    const parsed = JSON.parse(result)
    
    expect(parsed.success).toBe(true)
    expect(parsed.action).toBe("resume")
    expect(parsed.loopState).toBeDefined()
    
    // Check that pause file is removed
    const exists = await fs.access(pauseFile).then(() => true).catch(() => false)
    expect(exists).toBe(false)
  })

  function mockContext() {
    return {
      sessionID: "test-session",
      messageID: "test-message", 
      agent: "test-agent",
      abort: new AbortController().signal,
    }
  }

  test("status returns state", async () => {
    const result = await tool.execute({ action: "status" }, mockContext())
    const parsed = JSON.parse(result)
    
    expect(parsed.success).toBe(true)
    expect(parsed.action).toBe("status")
    expect(parsed.status).toBeDefined()
    expect(parsed.loopState).toBeDefined()
  })

  test("invalid action returns error", async () => {
    const result = await tool.execute({ action: "invalid" as any }, mockContext())
    const parsed = JSON.parse(result)
    
    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain("Loop control failed")
  })

  test("handles missing state file gracefully", async () => {
    // Remove state file
    await fs.rm(path.join(testDir, ".globex", "state.json"))
    
    const result = await tool.execute({ action: "status" }, mockContext())
    const parsed = JSON.parse(result)
    
    // Should still return success but with empty/default state
    expect(parsed.success).toBe(true)
    expect(parsed.action).toBe("status")
  })
})