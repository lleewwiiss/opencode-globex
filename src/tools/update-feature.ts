import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { getGlobexDir } from "../state/persistence.js"

interface Feature {
  id: string
  description: string
  passes: boolean
  priority: number
  dependencies: string[]
  [key: string]: unknown
}

interface FeaturesFile {
  features: Feature[]
  [key: string]: unknown
}

export const createUpdateFeature = (workdir: string): ToolDefinition => tool({
  description: "Update a feature's status in features.json (mark as passes=true after implementation)",
  args: {
    featureId: tool.schema.string(),
    passes: tool.schema.boolean(),
    notes: tool.schema.string().optional(),
  },
  async execute(args) {
    const featuresPath = path.join(getGlobexDir(workdir), "features.json")
    
    try {
      const content = await fs.readFile(featuresPath, "utf-8")
      const data: FeaturesFile = JSON.parse(content)
      
      const featureIndex = data.features.findIndex(f => f.id === args.featureId)
      if (featureIndex === -1) {
        return JSON.stringify({
          success: false,
          error: `Feature ${args.featureId} not found`,
        })
      }
      
      data.features[featureIndex] = {
        ...data.features[featureIndex],
        passes: args.passes,
        completedAt: args.passes ? new Date().toISOString() : undefined,
        notes: args.notes,
      }
      
      await fs.writeFile(featuresPath, JSON.stringify(data, null, 2))
      
      const remaining = data.features.filter(f => !f.passes).length
      const total = data.features.length
      
      return JSON.stringify({
        success: true,
        featureId: args.featureId,
        passes: args.passes,
        progress: `${total - remaining}/${total} complete`,
        remaining,
      })
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: `Failed to read features.json: ${err}`,
      })
    }
  },
})
