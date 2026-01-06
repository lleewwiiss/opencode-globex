export type Phase = 
  | "init"
  | "research"
  | "research_interview"
  | "plan"
  | "plan_interview"
  | "features"
  | "features_interview"
  | "execute"
  | "complete"

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
  "features_interview",
  "execute",
  "complete"
]

export const PHASE_TRANSITIONS: Record<Phase, Phase[]> = {
  init: ["research"],
  research: ["research_interview"],
  research_interview: ["plan", "research"],
  plan: ["plan_interview"],
  plan_interview: ["features", "plan"],
  features: ["features_interview"],
  features_interview: ["execute", "features"],
  execute: ["complete"],
  complete: []
}
