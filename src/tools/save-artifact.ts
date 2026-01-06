import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { recordArtifact, getGlobexDir } from "../state/persistence.js"

export const createSaveArtifact = (workdir: string): ToolDefinition => tool({
  description: "Save a globex artifact (research.md, plan.md, features.json, etc) to the .globex directory",
  args: {
    name: tool.schema.string(),
    content: tool.schema.string(),
  },
  async execute(args) {
    const globexDir = getGlobexDir(workdir)
    const filePath = path.join(globexDir, args.name)
    
    await fs.mkdir(globexDir, { recursive: true })
    await fs.writeFile(filePath, args.content)
    
    const effect = recordArtifact(workdir, args.name, filePath)
    await Effect.runPromise(effect).catch(() => {})
    
    return `Saved artifact: ${args.name}`
  },
})
