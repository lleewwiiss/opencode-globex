import { Schema } from "effect"

export const ConfidenceSchema = Schema.Union(
  Schema.Literal("verified"),
  Schema.Literal("unverified"),
  Schema.Literal("hypothesis")
)
export type Confidence = Schema.Schema.Type<typeof ConfidenceSchema>

export const CitationSchema = Schema.Struct({
  claim: Schema.String,
  path: Schema.String,
  lineStart: Schema.Number,
  lineEnd: Schema.Number,
  excerptHash: Schema.optional(Schema.String),
  confidence: Schema.optional(ConfidenceSchema),
})
export type Citation = Schema.Schema.Type<typeof CitationSchema>

export const ResearchCitationsSchema = Schema.Struct({
  citations: Schema.Array(CitationSchema),
})
export type ResearchCitations = Schema.Schema.Type<typeof ResearchCitationsSchema>

export const LikelihoodSchema = Schema.Union(
  Schema.Literal("low"),
  Schema.Literal("medium"),
  Schema.Literal("high")
)
export type Likelihood = Schema.Schema.Type<typeof LikelihoodSchema>

export const ImpactSchema = Schema.Union(
  Schema.Literal("low"),
  Schema.Literal("medium"),
  Schema.Literal("high")
)
export type Impact = Schema.Schema.Type<typeof ImpactSchema>

export const RiskSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  description: Schema.String,
  likelihood: LikelihoodSchema,
  impact: ImpactSchema,
  mitigation: Schema.String,
  verification: Schema.optional(Schema.String),
})
export type Risk = Schema.Schema.Type<typeof RiskSchema>

export const PlanRisksSchema = Schema.Struct({
  risks: Schema.Array(RiskSchema),
})
export type PlanRisks = Schema.Schema.Type<typeof PlanRisksSchema>

export const FeatureCategorySchema = Schema.Union(
  Schema.Literal("infrastructure"),
  Schema.Literal("functional"),
  Schema.Literal("refactor"),
  Schema.Literal("test")
)
export type FeatureCategory = Schema.Schema.Type<typeof FeatureCategorySchema>

export const FeatureVerificationSchema = Schema.Struct({
  automated: Schema.optional(Schema.Array(Schema.String)),
  manual: Schema.optional(Schema.Array(Schema.String)),
})
export type FeatureVerification = Schema.Schema.Type<typeof FeatureVerificationSchema>

export const PatternRefSchema = Schema.Struct({
  file: Schema.String,
  lines: Schema.String,
  pattern: Schema.String,
})
export type PatternRef = Schema.Schema.Type<typeof PatternRefSchema>

export const FeatureSchema = Schema.Struct({
  id: Schema.String,
  description: Schema.String,
  category: Schema.optional(FeatureCategorySchema),
  acceptanceCriteria: Schema.optional(Schema.Array(Schema.String)),
  verification: Schema.optional(FeatureVerificationSchema),
  passes: Schema.Boolean,
  priority: Schema.Number,
  dependencies: Schema.Array(Schema.String),
  filesTouched: Schema.optional(Schema.Array(Schema.String)),
  attempts: Schema.optional(Schema.Number),
  patternsToFollow: Schema.optional(Schema.Array(PatternRefSchema)),
  completedAt: Schema.optional(Schema.String),
})
export type Feature = Schema.Schema.Type<typeof FeatureSchema>

export const FeaturesSummarySchema = Schema.Struct({
  total: Schema.Number,
  byCategory: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Number,
  })),
})
export type FeaturesSummary = Schema.Schema.Type<typeof FeaturesSummarySchema>

export const FeaturesSchema = Schema.Struct({
  features: Schema.Array(FeatureSchema),
  summary: Schema.optional(FeaturesSummarySchema),
})
export type Features = Schema.Schema.Type<typeof FeaturesSchema>
