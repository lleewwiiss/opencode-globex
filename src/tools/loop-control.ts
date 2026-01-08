import { tool, type ToolDefinition, type ToolContext } from "@opencode-ai/plugin"
import { Schema } from "effect"
import { loadLoopStateAsync } from "../state/persistence.js"
import { createLoopController, type LoopContext } from "../loop/controller.js"
import { createOpencodeClient as createV2Client } from "@opencode-ai/sdk/v2"
import * as path from "node:path"
import * as fs from "node:fs/promises"

const LoopActionSchema = Schema.Union(
  Schema.Literal("start"),
  Schema.Literal("pause"),
  Schema.Literal("resume"),
  Schema.Literal("status")
)

export const createLoopControl = (workdir: string): ToolDefinition => tool({
  description: `Create src/tools/loop-control.ts tool definition

Tool accepts action: start | pause | resume | status
Optional maxIterations and model args
start spawns loop in background (non-blocking)
Returns JSON: {success, action, loopState?}`,
  args: {
    action: tool.schema.enum(["start", "pause", "resume", "status"]),
    maxIterations: tool.schema.number().optional(),
    model: tool.schema.string().optional(),
  },
  async execute(args, _context: ToolContext) {
    try {
      const { action, maxIterations, model } = args

      // Validate action
      const parsedAction = Schema.decodeSync(LoopActionSchema)(action)

      // Create a minimal SDK v2 client for session management
      const v2Client = createV2Client({
        baseUrl: process.env.OPENCODE_SERVER_URL || "http://localhost:42000"
      })

      // Simple logging and toast stubs for MVP
      const stubShowToast = async (message: string, variant?: "info" | "success" | "warning" | "error", title?: string) => {
        // Write to simple log file for now
        const logPath = path.join(workdir, ".globex", "loop.log")
        const timestamp = new Date().toISOString()
        const logEntry = `[${timestamp}] TOAST [${variant || "info"}] ${title ? title + ": " : ""}${message}\n`
        await fs.appendFile(logPath, logEntry).catch(() => {})
      }

      const stubLog = async (message: string, level?: "info" | "warn" | "error" | "debug") => {
        const logPath = path.join(workdir, ".globex", "loop.log")
        const timestamp = new Date().toISOString()
        const logEntry = `[${timestamp}] ${(level || "info").toUpperCase()} ${message}\n`
        await fs.appendFile(logPath, logEntry).catch(() => {})
      }

      const loopContext: LoopContext = {
        workdir,
        client: v2Client,
        showToast: stubShowToast,
        log: stubLog,
        model: model ?? "claude-3-5-sonnet-20241022"
      }

      const controller = createLoopController(loopContext)
      
      switch (parsedAction) {
        case "start":
          // Start loop in background (non-blocking)
          void controller.start(maxIterations ?? 50).catch(async (error) => {
            await stubLog(`Loop error: ${error}`, "error")
            await stubShowToast("Loop failed", "error", "Globex")
          })
          
          return JSON.stringify({
            success: true,
            action: "start",
            maxIterations: maxIterations ?? 50,
            model: model ?? "claude-3-5-sonnet-20241022"
          })

        case "pause":
          await controller.pause()
          const pausedState = await loadLoopStateAsync(workdir)
          return JSON.stringify({
            success: true,
            action: "pause",
            loopState: pausedState
          })

        case "resume":
          await controller.resume()
          const resumedState = await loadLoopStateAsync(workdir)
          return JSON.stringify({
            success: true,
            action: "resume",
            loopState: resumedState
          })

        case "status":
          const status = await controller.status()
          const currentState = await loadLoopStateAsync(workdir)
          return JSON.stringify({
            success: true,
            action: "status",
            status,
            loopState: currentState
          })

        default:
          return JSON.stringify({
            success: false,
            error: `Invalid action: ${action}`
          })
      }
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Loop control failed: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  },
})