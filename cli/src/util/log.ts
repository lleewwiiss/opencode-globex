import { appendFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const LOG_DIR = ".globex"
const LOG_FILE = "debug.log"

function getLogPath(): string {
  return join(process.cwd(), LOG_DIR, LOG_FILE)
}

function ensureLogDir(): void {
  const dir = join(process.cwd(), LOG_DIR)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

let initialized = false

export function initLog(reset: boolean = false): void {
  ensureLogDir()
  const logPath = getLogPath()
  
  if (reset || !existsSync(logPath)) {
    writeFileSync(logPath, `=== Globex Log Started: ${new Date().toISOString()} ===\n`)
  } else {
    appendFileSync(logPath, `\n=== Globex Session Resumed: ${new Date().toISOString()} ===\n`)
  }
  initialized = true
}

export function log(category: string, message: string, data?: unknown): void {
  if (!initialized) {
    initLog(false)
  }

  const timestamp = new Date().toISOString()
  let line = `[${timestamp}] [${category}] ${message}`
  if (data !== undefined) {
    try {
      line += ` ${JSON.stringify(data)}`
    } catch {
      line += ` [unstringifiable data]`
    }
  }

  try {
    appendFileSync(getLogPath(), line + "\n")
  } catch {
    // Silently fail if we can't write logs
  }
}
