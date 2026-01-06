import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as crypto from "node:crypto"

export const createVerifyCitation = (workdir: string): ToolDefinition => tool({
  description: "Verify a citation by checking if the file:line content matches the claimed excerpt",
  args: {
    filePath: tool.schema.string(),
    lineStart: tool.schema.number(),
    lineEnd: tool.schema.number(),
    expectedHash: tool.schema.string().optional(),
  },
  async execute(args) {
    const fullPath = path.isAbsolute(args.filePath) 
      ? args.filePath 
      : path.join(workdir, args.filePath)
    
    try {
      const content = await fs.readFile(fullPath, "utf-8")
      const lines = content.split("\n")
      
      if (args.lineStart < 1 || args.lineEnd > lines.length) {
        return JSON.stringify({
          valid: false,
          reason: `Line range ${args.lineStart}-${args.lineEnd} out of bounds (file has ${lines.length} lines)`,
        })
      }
      
      const excerpt = lines.slice(args.lineStart - 1, args.lineEnd).join("\n")
      const hash = crypto.createHash("sha256").update(excerpt).digest("hex").slice(0, 8)
      
      if (args.expectedHash && hash !== args.expectedHash) {
        return JSON.stringify({
          valid: false,
          reason: "Content has changed since citation was created",
          currentHash: hash,
          expectedHash: args.expectedHash,
          excerpt: excerpt.slice(0, 200) + (excerpt.length > 200 ? "..." : ""),
        })
      }
      
      return JSON.stringify({
        valid: true,
        hash,
        excerpt: excerpt.slice(0, 500) + (excerpt.length > 500 ? "..." : ""),
        lineCount: args.lineEnd - args.lineStart + 1,
      })
    } catch {
      return JSON.stringify({
        valid: false,
        reason: `File not found: ${args.filePath}`,
      })
    }
  },
})
