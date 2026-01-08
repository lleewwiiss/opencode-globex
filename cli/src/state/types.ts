export type Phase =
  | "init"
  | "research"
  | "research_interview"
  | "plan"
  | "plan_interview"
  | "features"
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
  noNewGapsStreak: number
  duration: string
  startedAt: string
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
}

export type TUIStatus = "idle" | "running" | "paused" | "waiting_approval" | "error"

export interface TUIEvent {
  type: "phase_change" | "feature_complete" | "approval_needed" | "error" | "info"
  message: string
  timestamp: string
  featureId?: string
}

export interface TUIState {
  status: TUIStatus
  phase: Phase
  iteration: number
  featuresComplete: number
  totalFeatures: number
  events: TUIEvent[]
  error: string | null
  isIdle: boolean
}

export const PHASE_ORDER: Phase[] = [
  "init",
  "research",
  "research_interview",
  "plan",
  "plan_interview",
  "features",
  "execute",
  "complete",
]

export const PHASE_TRANSITIONS: Record<Phase, Phase[]> = {
  init: ["research"],
  research: ["research_interview"],
  research_interview: ["plan", "research"],
  plan: ["plan_interview"],
  plan_interview: ["features", "plan"],
  features: ["execute"],
  execute: ["complete"],
  complete: [],
}

export type LoopStatus = "running" | "paused" | "complete" | "error"

export interface LoopState {
  status: LoopStatus
  iteration: number
  currentFeatureId?: string
  lastCommitHash?: string
  totalIterations?: number
  startedAt?: string
  pausedAt?: string
  ralphSessionId?: string
  wiggumSessionId?: string
  lastSignal?: "approved" | "rejected"
  completedFeatures: string[]
  blockedFeatures: string[]
}
