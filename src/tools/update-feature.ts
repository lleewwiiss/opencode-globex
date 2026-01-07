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
  description: `Update a feature's completion status in features.json.

ALLOWED FIELDS ONLY: passes, blocked, blockedReason, notes.
This tool intentionally prevents modification of feature requirements (description, acceptanceCriteria, dependencies, etc.) to maintain spec integrity.

Returns: { success, featureId, passes, blocked, progress, remaining }`,
  args: {
    featureId: tool.schema.string(),
    passes: tool.schema.boolean().optional(),
    blocked: tool.schema.boolean().optional(),
    blockedReason: tool.schema.string().optional(),
    notes: tool.schema.string().optional(),
  },
  async execute(args) {
    const featuresPath = path.join(getGlobexDir(workdir), "features.json")

    if (args.passes === undefined && args.blocked === undefined) {
      return JSON.stringify({
        success: false,
        error: "Must provide either 'passes' or 'blocked' status",
      })
    }
    
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

      const feature = data.features[featureIndex]
      
      if (args.passes !== undefined) {
        feature.passes = args.passes
        if (args.passes) {
          feature.completedAt = new Date().toISOString()
        }
      }
      
      if (args.blocked !== undefined) {
        feature.blocked = args.blocked
        if (args.blockedReason) {
          feature.blockedReason = args.blockedReason
        }
      }
      
      if (args.notes !== undefined) {
        feature.notes = args.notes
      }
      
      await fs.writeFile(featuresPath, JSON.stringify(data, null, 2))
      
      const remaining = data.features.filter(f => !f.passes).length
      const total = data.features.length
      
      return JSON.stringify({
        success: true,
        featureId: args.featureId,
        passes: feature.passes,
        blocked: feature.blocked,
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
