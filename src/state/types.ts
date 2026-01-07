export type Phase = 
  | "init"
  | "plan"
  | "interview"
  | "features"
  | "execute"

export interface PatternRef {
  file: string
  lines: string
  pattern: string
}

export type ApprovalStatus = "pending" | "approved" | "approved_with_risks" | "rejected"

export interface Approval {
  status: ApprovalStatus
  timestamp: string
  risks?: string[]
  notes?: string
}

export interface InterviewHistory {
  questionsAsked: number
  convergenceRound: number
  noNewGapsStreak: number
  duration: string
  startedAt: string
}

export interface ExecutionState {
  iteration: number
  maxIterations: number
  startedAt: string
  lastIterationAt: string
  completionPromise: string
  learnings: string[]
}

export interface GlobexState {
  currentPhase: Phase
  projectName: string
  description: string
  createdAt: string
  updatedAt: string
  approvals: Partial<Record<"plan" | "features", Approval>>
  artifacts: Partial<Record<string, string>>
  interviewHistory: Partial<Record<"plan" | "features", InterviewHistory>>
  execution?: ExecutionState
}

export const PHASE_ORDER: Phase[] = [
  "init",
  "plan",
  "interview",
  "features",
  "execute"
]

export const PHASE_TRANSITIONS: Record<Phase, Phase[]> = {
  init: ["plan"],
  plan: ["interview"],
  interview: ["features", "plan"],
  features: ["execute"],
  execute: []
}
