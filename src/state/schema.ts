import { Schema } from "effect"

export const PhaseSchema = Schema.Union(
  Schema.Literal("init"),
  Schema.Literal("plan"),
  Schema.Literal("interview"),
  Schema.Literal("features"),
  Schema.Literal("execute")
)
export type Phase = Schema.Schema.Type<typeof PhaseSchema>

export const ApprovalStatusSchema = Schema.Union(
  Schema.Literal("pending"),
  Schema.Literal("approved"),
  Schema.Literal("approved_with_risks"),
  Schema.Literal("rejected")
)
export type ApprovalStatus = Schema.Schema.Type<typeof ApprovalStatusSchema>

export const ApprovalSchema = Schema.Struct({
  status: ApprovalStatusSchema,
  timestamp: Schema.String,
  risks: Schema.optional(Schema.Array(Schema.String)),
  notes: Schema.optional(Schema.String),
})
export type Approval = Schema.Schema.Type<typeof ApprovalSchema>

export const InterviewHistorySchema = Schema.Struct({
  questionsAsked: Schema.Number,
  convergenceRound: Schema.Number,
  noNewGapsStreak: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  duration: Schema.String,
  startedAt: Schema.String,
})
export type InterviewHistory = Schema.Schema.Type<typeof InterviewHistorySchema>

export const ExecutionStateSchema = Schema.Struct({
  iteration: Schema.Number,
  maxIterations: Schema.Number,
  startedAt: Schema.String,
  lastIterationAt: Schema.String,
  completionPromise: Schema.String,
  learnings: Schema.Array(Schema.String),
})
export type ExecutionState = Schema.Schema.Type<typeof ExecutionStateSchema>

export const ApprovablePhaseSchema = Schema.Union(
  Schema.Literal("plan"),
  Schema.Literal("features")
)
export type ApprovablePhase = Schema.Schema.Type<typeof ApprovablePhaseSchema>

export const GlobexStateSchema = Schema.Struct({
  currentPhase: PhaseSchema,
  projectName: Schema.String,
  description: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  approvals: Schema.partial(Schema.Record({
    key: ApprovablePhaseSchema,
    value: ApprovalSchema,
  })),
  artifacts: Schema.partial(Schema.Record({
    key: Schema.String,
    value: Schema.String,
  })),
  interviewHistory: Schema.partial(Schema.Record({
    key: ApprovablePhaseSchema,
    value: InterviewHistorySchema,
  })),
  execution: Schema.optional(ExecutionStateSchema),
})
export type GlobexState = Schema.Schema.Type<typeof GlobexStateSchema>

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

export const LoopStatusSchema = Schema.Union(
  Schema.Literal("idle"),
  Schema.Literal("running"),
  Schema.Literal("paused"),
  Schema.Literal("complete")
)
export type LoopStatus = Schema.Schema.Type<typeof LoopStatusSchema>

export const LoopStateSchema = Schema.Struct({
  status: LoopStatusSchema,
  currentFeatureId: Schema.NullOr(Schema.String),
  lastCommitHash: Schema.NullOr(Schema.String),
  iteration: Schema.Number,
  totalIterations: Schema.NullOr(Schema.Number),
  startedAt: Schema.NullOr(Schema.String),
  pausedAt: Schema.NullOr(Schema.String),
  ralphSessionId: Schema.NullOr(Schema.String),
  wiggumSessionId: Schema.NullOr(Schema.String),
  lastSignal: Schema.NullOr(Schema.String),
  completedFeatures: Schema.Array(Schema.String),
  blockedFeatures: Schema.Array(Schema.String),
})
export type LoopState = Schema.Schema.Type<typeof LoopStateSchema>
