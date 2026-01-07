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
  category?: string
  acceptanceCriteria?: string[]
  filesTouched?: string[]
  estimatedMinutes?: number
  [key: string]: unknown
}

interface FeaturesFile {
  features: Feature[]
  [key: string]: unknown
}

export const createGetNextFeature = (workdir: string): ToolDefinition => tool({
  description: `Get the next eligible feature to implement (passes=false, dependencies satisfied, highest priority).

Returns JSON with one of:
- {feature: {...}, progress: {completed, remaining, total}} - next feature to implement
- {done: true, totalFeatures} - all features complete, output <promise>ALL_FEATURES_COMPLETE</promise>
- {blocked: true, blockedFeatures: [...]} - no eligible features due to unsatisfied dependencies
- {error: string} - failed to read features.json`,
  args: {},
  async execute() {
    const featuresPath = path.join(getGlobexDir(workdir), "features.json")
    
    try {
      const content = await fs.readFile(featuresPath, "utf-8")
      const data: FeaturesFile = JSON.parse(content)
      
      const completedIds = new Set(
        data.features.filter(f => f.passes).map(f => f.id)
      )
      
      const eligible = data.features
        .filter(f => !f.passes)
        .filter(f => f.dependencies.every(dep => completedIds.has(dep)))
        .sort((a, b) => a.priority - b.priority)
      
      if (eligible.length === 0) {
        const incomplete = data.features.filter(f => !f.passes)
        if (incomplete.length === 0) {
          return JSON.stringify({
            done: true,
            message: "All features complete!",
            totalFeatures: data.features.length,
          })
        }
        
        return JSON.stringify({
          blocked: true,
          message: "No eligible features - all remaining have unsatisfied dependencies",
          blockedFeatures: incomplete.map(f => ({
            id: f.id,
            description: f.description,
            waitingOn: f.dependencies.filter(d => !completedIds.has(d)),
          })),
        })
      }
      
      const next = eligible[0]
      const remaining = data.features.filter(f => !f.passes).length
      
      return JSON.stringify({
        feature: {
          id: next.id,
          description: next.description,
          category: next.category,
          priority: next.priority,
          acceptanceCriteria: next.acceptanceCriteria,
          filesTouched: next.filesTouched,
          estimatedMinutes: next.estimatedMinutes,
          dependencies: next.dependencies,
        },
        progress: {
          completed: data.features.length - remaining,
          remaining,
          total: data.features.length,
        },
      })
    } catch (err) {
      return JSON.stringify({
        error: `Failed to read features.json: ${err}`,
      })
    }
  },
})
