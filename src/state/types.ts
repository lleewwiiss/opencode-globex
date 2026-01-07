export type Phase = 
  | "init"
  | "research"
  | "research_interview"
  | "plan"
  | "plan_interview"
  | "features"
  | "execute"
  | "complete"

export interface PatternRef {
  file: string
  lines: string
  pattern: string
}

export type ApprovalStatus = "pending" | "approved" | "rejected"

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
  approvals: Partial<Record<"research" | "plan" | "features", Approval>>
  artifacts: Partial<Record<string, string>>
  interviewHistory: Partial<Record<"research" | "plan" | "features", InterviewHistory>>
  execution?: ExecutionState
}

export const PHASE_ORDER: Phase[] = [
  "init",
  "research",
  "research_interview",
  "plan",
  "plan_interview",
  "features",
  "execute",
  "complete"
]

export const PHASE_TRANSITIONS: Record<Phase, Phase[]> = {
  init: ["research"],
  research: ["research_interview"],
  research_interview: ["plan", "research"],
  plan: ["plan_interview"],
  plan_interview: ["features", "plan"],
  features: ["execute"],
  execute: ["complete"],
  complete: []
}
