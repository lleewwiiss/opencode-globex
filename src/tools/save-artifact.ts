import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect, Either, Schema } from "effect"
import { ArrayFormatter, type ParseError } from "effect/ParseResult"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { recordArtifact, getGlobexDir } from "../state/persistence.js"
import { ResearchCitationsSchema, PlanRisksSchema, FeaturesSchema } from "../state/schema.js"

const SCHEMA_MAP: Record<string, Schema.Schema.Any> = {
  "research.citations.json": ResearchCitationsSchema,
  "plan.risks.json": PlanRisksSchema,
  "features.json": FeaturesSchema,
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
    const globexDir = getGlobexDir(workdir)
    const filePath = path.join(globexDir, args.name)
    
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
    
    await fs.mkdir(globexDir, { recursive: true })
    await fs.writeFile(filePath, args.content)
    
    const effect = recordArtifact(workdir, args.name, filePath)
    await Effect.runPromise(effect).catch(() => {})
    
    return JSON.stringify({
      success: true,
      artifact: args.name,
      path: filePath,
      validated: !!schema,
    })
  },
})
