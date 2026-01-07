import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect, Either, Schema } from "effect"
import { ArrayFormatter, type ParseError } from "effect/ParseResult"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { recordArtifact, getActiveProject, getProjectDir, updatePhase, readState } from "../state/persistence.js"
import { ResearchCitationsSchema, PlanRisksSchema, FeaturesSchema } from "../state/schema.js"
import type { Phase } from "../state/types.js"

const SCHEMA_MAP: Record<string, Schema.Schema.Any> = {
  "research.citations.json": ResearchCitationsSchema,
  "plan.risks.json": PlanRisksSchema,
  "features.json": FeaturesSchema,
}

const AUTO_TRANSITION_MAP: Record<string, { fromPhase: Phase; toPhase: Phase; nextAction: string }> = {
  "plan.md": { fromPhase: "plan", toPhase: "interview", nextAction: "/globex-interview" },
  "features.json": { fromPhase: "features", toPhase: "execute", nextAction: "/globex-run" },
}

function formatSchemaError(error: ParseError): string {
  return ArrayFormatter.formatErrorSync(error)
    .map(e => `${e.path.join(".")}: ${e.message}`)
    .join("; ")
}

export const createSaveArtifact = (workdir: string): ToolDefinition => tool({
  description: `Save a globex artifact to .globex directory.

JSON artifacts are schema-validated: features.json, research.citations.json, plan.risks.json.
Markdown artifacts are saved as-is: research.md, plan.md, progress.md.

Returns JSON: {success: true, artifact, path, validated} or {success: false, error, issues?}`,
  args: {
    name: tool.schema.string(),
    content: tool.schema.string(),
  },
  async execute(args) {
    const projectId = await Effect.runPromise(getActiveProject(workdir))
    const projectDir = getProjectDir(workdir, projectId)
    const filePath = path.join(projectDir, args.name)

    const schema = SCHEMA_MAP[args.name]
    if (schema) {
      try {
        const parsed = JSON.parse(args.content)
        const result = Schema.decodeUnknownEither(schema as Schema.Schema<unknown, unknown>)(parsed)
        if (Either.isLeft(result)) {
          const issues = formatSchemaError(result.left)
          return JSON.stringify({
            success: false,
            error: `Schema validation failed for ${args.name}`,
            issues,
          })
        }
      } catch (parseErr) {
        return JSON.stringify({
          success: false,
          error: `Invalid JSON in ${args.name}: ${parseErr}`,
        })
      }
    }

    await fs.mkdir(projectDir, { recursive: true })
    await fs.writeFile(filePath, args.content)

    const effect = recordArtifact(workdir, args.name, filePath, projectId)
    await Effect.runPromise(effect).catch(() => {})

    const transition = AUTO_TRANSITION_MAP[args.name]
    let transitioned = false
    let nextAction: string | undefined

    if (transition) {
      try {
        const state = await Effect.runPromise(readState(workdir, projectId))
        if (state.currentPhase === transition.fromPhase) {
          await Effect.runPromise(updatePhase(workdir, transition.toPhase, projectId))
          transitioned = true
          nextAction = transition.nextAction
        }
      } catch {
        // State read/write failed, skip auto-transition
      }
    }

    return JSON.stringify({
      success: true,
      artifact: args.name,
      path: filePath,
      validated: !!schema,
      transitioned,
      nextAction,
    })
  },
})
