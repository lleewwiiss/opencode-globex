import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const LEARNINGS_HEADER = "## Globex Learnings (auto-generated)"
const LEARNINGS_FOOTER = "<!-- end globex learnings -->"

export const createAddLearning = (workdir: string): ToolDefinition => tool({
  description: "Add critical operational learning to AGENTS.md. OpenCode reads this file automatically, so learnings persist across ALL sessions. Use for build commands, environment setup, non-obvious dependencies.",
  args: {
    learning: tool.schema.string(),
  },
  async execute(args) {
    const agentsPath = path.join(workdir, "AGENTS.md")
    
    let content = ""
    try {
      content = await fs.readFile(agentsPath, "utf-8")
    } catch {
      content = "# AGENTS.md\n\nProject-specific instructions for AI agents.\n\n"
    }
    
    const learningLine = `- ${args.learning}`
    
    if (content.includes(learningLine)) {
      return JSON.stringify({
        success: true,
        action: "skipped",
        reason: "Learning already exists in AGENTS.md",
      })
    }
    
    if (content.includes(LEARNINGS_HEADER)) {
      const footerIndex = content.indexOf(LEARNINGS_FOOTER)
      if (footerIndex !== -1) {
        const insertPoint = footerIndex
        content = content.slice(0, insertPoint) + learningLine + "\n" + content.slice(insertPoint)
      } else {
        const headerIndex = content.indexOf(LEARNINGS_HEADER)
        const afterHeader = headerIndex + LEARNINGS_HEADER.length
        const nextNewline = content.indexOf("\n", afterHeader)
        const insertPoint = nextNewline !== -1 ? nextNewline + 1 : content.length
        content = content.slice(0, insertPoint) + "\n" + learningLine + "\n" + content.slice(insertPoint)
      }
    } else {
      const section = `\n${LEARNINGS_HEADER}\n\n${learningLine}\n${LEARNINGS_FOOTER}\n`
      content = content.trimEnd() + "\n" + section
    }
    
    await fs.writeFile(agentsPath, content)
    
    return JSON.stringify({
      success: true,
      action: "added",
      learning: args.learning,
      path: agentsPath,
    })
  },
})
