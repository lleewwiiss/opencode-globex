import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { getProjectDir, getActiveProject, readState, writeState } from "../state/persistence.js"

interface Feature {
  id: string
  description: string
  passes: boolean
  completedAt?: string
  [key: string]: unknown
}

interface FeaturesFile {
  features: Feature[]
  [key: string]: unknown
}

export const createUpdateProgress = (workdir: string): ToolDefinition => tool({
  description: "Update progress.md with current feature status, completed features, blocked items, and learnings. Use 'learning' to add operational knowledge for future iterations.",
  args: {
    currentFeatureId: tool.schema.string().optional(),
    blockedFeatures: tool.schema.array(tool.schema.object({
      featureId: tool.schema.string(),
      reason: tool.schema.string(),
    })).optional(),
    learning: tool.schema.string().optional(),
    incrementIteration: tool.schema.boolean().optional(),
  },
  async execute(args) {
    const effect = Effect.gen(function* () {
      const projectId = yield* getActiveProject(workdir)
      const projectDir = getProjectDir(workdir, projectId)
      const featuresPath = path.join(projectDir, "features.json")
      const progressPath = path.join(projectDir, "progress.md")

      const state = yield* readState(workdir, projectId)
      
      if (!state.execution) {
        state.execution = {
          iteration: 1,
          maxIterations: 100,
          startedAt: new Date().toISOString(),
          lastIterationAt: new Date().toISOString(),
          completionPromise: "ALL_FEATURES_COMPLETE",
          learnings: [],
        }
      }
      
      if (args.learning && !state.execution.learnings.includes(args.learning)) {
        state.execution.learnings.push(args.learning)
      }
      
      if (args.incrementIteration) {
        state.execution.iteration += 1
        state.execution.lastIterationAt = new Date().toISOString()
      }
      
      yield* writeState(workdir, state, projectId)
      
      const content = yield* Effect.tryPromise(() => fs.readFile(featuresPath, "utf-8"))
      const data: FeaturesFile = JSON.parse(content)
      
      const completed = data.features
        .filter(f => f.passes)
        .sort((a, b) => (a.completedAt || "").localeCompare(b.completedAt || ""))
      
      const remaining = data.features
        .filter(f => !f.passes)
        .sort((a, b) => (a as any).priority - (b as any).priority)
      
      const blocked = args.blockedFeatures || []
      const blockedIds = new Set(blocked.map(b => b.featureId))
      
      const currentFeature = args.currentFeatureId 
        ? data.features.find(f => f.id === args.currentFeatureId)
        : null
      
      const recentLearnings = state.execution.learnings.slice(-5)
      const feedbackSection = recentLearnings.length > 0
        ? recentLearnings.map((l: string) => `- ${l}`).join("\n")
        : "(none)"
      
      const md = `# Progress

## Iteration
Current: ${state.execution.iteration} / ${state.execution.maxIterations}
Started: ${state.execution.startedAt}
Completion Promise: <promise>${state.execution.completionPromise}</promise>

## Current
${currentFeature 
  ? `Working on: ${currentFeature.id} - ${currentFeature.description}
Started: ${new Date().toISOString()}`
  : "(idle)"}

## Completed (${completed.length}/${data.features.length})
${completed.length > 0 
  ? completed.map(f => `- [x] ${f.id} - ${f.description}`).join("\n")
  : "(none yet)"}

## Blocked (${blocked.length})
${blocked.length > 0
  ? blocked.map(b => `- ${b.featureId} - ${b.reason}`).join("\n")
  : "(none)"}

## Remaining (${remaining.filter(f => !blockedIds.has(f.id)).length})
${remaining
  .filter(f => !blockedIds.has(f.id))
  .slice(0, 5)
  .map(f => `- [ ] ${f.id} - ${f.description}`)
  .join("\n")}
${remaining.length > 5 ? `\n... and ${remaining.length - 5} more` : ""}

## Recent Feedback
${feedbackSection}

---
Last updated: ${new Date().toISOString()}
`
      
      yield* Effect.tryPromise(() => fs.writeFile(progressPath, md))
      
      return {
        success: true,
        path: progressPath,
        completed: completed.length,
        remaining: remaining.length,
        blocked: blocked.length,
        iteration: state.execution.iteration,
        learnings: state.execution.learnings.length,
      }
    })
    
    const result = await Effect.runPromise(effect)
    return JSON.stringify(result)
  },
})
