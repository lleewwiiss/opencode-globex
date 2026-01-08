import { Either, Schema } from "effect"
import { ArrayFormatter, type ParseError } from "effect/ParseResult"
import {
  FeaturesSchema,
  ResearchCitationsSchema,
  PlanRisksSchema,
  type Features,
  type ResearchCitations,
  type PlanRisks,
} from "../../../src/state/schema.js"

export interface ValidationError {
  path: string
  message: string
}

export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: ValidationError[]
}

function formatErrors(error: ParseError): ValidationError[] {
  return ArrayFormatter.formatErrorSync(error).map(e => ({
    path: e.path.join(".") || "(root)",
    message: e.message,
  }))
}

function validateJson<A, I>(
  content: string,
  schema: Schema.Schema<A, I>
): ValidationResult<A> {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    return {
      success: false,
      errors: [{ path: "(root)", message: `Invalid JSON: ${e instanceof Error ? e.message : "parse error"}` }],
    }
  }

  const result = Schema.decodeUnknownEither(schema)(parsed)
  if (Either.isLeft(result)) {
    return {
      success: false,
      errors: formatErrors(result.left),
    }
  }

  return {
    success: true,
    data: result.right,
  }
}

export function validateFeaturesJson(content: string): ValidationResult<Features> {
  return validateJson(content, FeaturesSchema)
}

export function validateCitationsJson(content: string): ValidationResult<ResearchCitations> {
  return validateJson(content, ResearchCitationsSchema)
}

export function validateRisksJson(content: string): ValidationResult<PlanRisks> {
  return validateJson(content, PlanRisksSchema)
}
