import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { getProjectDir, getActiveProject } from "../state/persistence.js"

const MAX_ATTEMPTS = 5

interface Feature {
  id: string
  description: string
  passes: boolean
  priority: number
  dependencies: string[]
  blocked?: boolean
  blockedReason?: string
  attempts?: number
  [key: string]: unknown
}

interface FeaturesFile {
  features: Feature[]
  [key: string]: unknown
}

const cascadeBlock = (
  features: Feature[],
  blockedId: string,
  visited: Set<string> = new Set()
): void => {
  if (visited.has(blockedId)) return
  visited.add(blockedId)

  for (const feature of features) {
    if (feature.dependencies?.includes(blockedId) && !feature.blocked) {
      feature.blocked = true
      feature.blockedReason = `Dependency ${blockedId} is blocked`
      cascadeBlock(features, feature.id, visited)
    }
  }
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
    const projectId = await Effect.runPromise(getActiveProject(workdir))
    const featuresPath = path.join(getProjectDir(workdir, projectId), "features.json")

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
          feature.attempts = (feature.attempts ?? 0) + 1
        } else {
          feature.attempts = (feature.attempts ?? 0) + 1
          if (feature.attempts >= MAX_ATTEMPTS) {
            feature.blocked = true
            feature.blockedReason = `Auto-blocked: exceeded ${MAX_ATTEMPTS} attempts`
            cascadeBlock(data.features, feature.id)
          }
        }
      }
      
      if (args.blocked !== undefined) {
        feature.blocked = args.blocked
        if (args.blockedReason) {
          feature.blockedReason = args.blockedReason
        }
        if (args.blocked) {
          cascadeBlock(data.features, feature.id)
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
        attempts: feature.attempts ?? 0,
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
