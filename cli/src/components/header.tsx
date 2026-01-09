/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { colors } from "./colors"
import { formatDuration } from "../util/time"
import type { Phase } from "../state/types"

const PHASE_ICONS: Record<Phase, string> = {
  init: "○",
  research: "◐",
  research_interview: "◑",
  plan: "◒",
  plan_interview: "◓",
  features: "◔",
  execute: "◕",
  complete: "●",
}

const PHASE_COLORS: Record<Phase, string> = {
  init: colors.fgMuted,
  research: colors.blue,
  research_interview: colors.cyan,
  plan: colors.purple,
  plan_interview: colors.cyan,
  features: colors.yellow,
  execute: colors.green,
  complete: colors.green,
}

const PHASE_LABELS: Record<Phase, string> = {
  init: "init",
  research: "research",
  research_interview: "interview",
  plan: "plan",
  plan_interview: "interview",
  features: "features",
  execute: "execute",
  complete: "complete",
}

export type HeaderProps = {
  phase: Phase
  projectName: string
  featuresComplete: number
  totalFeatures: number
  startedAt?: number
  eta?: number
  currentAgent?: "idle" | "ralph" | "wiggum"
  paused?: boolean
}

const AGENT_DISPLAY: Record<"idle" | "ralph" | "wiggum", { icon: string; color: string; label: string }> = {
  idle: { icon: "◌", color: colors.fgMuted, label: "idle" },
  ralph: { icon: "◉", color: colors.purple, label: "ralph" },
  wiggum: { icon: "★", color: colors.yellow, label: "wiggum" },
}

export function Header(props: HeaderProps) {
  const phaseIcon = () => PHASE_ICONS[props.phase]
  const phaseColor = () => PHASE_COLORS[props.phase]
  const phaseLabel = () => PHASE_LABELS[props.phase]

  const agentDisplay = () => {
    if (props.paused) return { icon: "⏸", color: colors.yellow, label: "paused" }
    return AGENT_DISPLAY[props.currentAgent ?? "idle"]
  }

  const progress = () => {
    if (props.totalFeatures === 0) return null
    return `${props.featuresComplete}/${props.totalFeatures}`
  }

  const progressPct = () => {
    if (props.totalFeatures === 0) return 0
    return Math.round((props.featuresComplete / props.totalFeatures) * 100)
  }

  const BAR_SEGMENTS = 10
  const filledCount = () =>
    props.totalFeatures > 0
      ? Math.round((props.featuresComplete / props.totalFeatures) * BAR_SEGMENTS)
      : 0
  const filledBar = () => "■".repeat(filledCount())
  const emptyBar = () => "□".repeat(BAR_SEGMENTS - filledCount())

  const etaText = () => {
    if (!props.eta || props.eta <= 0) return null
    return formatDuration(props.eta)
  }

  return (
    <box
      flexDirection="row"
      width="100%"
      height={2}
      alignItems="center"
      paddingLeft={1}
      paddingRight={1}
      borderStyle="single"
      border={["bottom"]}
      borderColor={colors.border}
      backgroundColor={colors.bg}
    >
      <text fg={phaseColor()}>{phaseIcon()}</text>
      <text fg={colors.fg}> {props.projectName}</text>
      <text fg={colors.fgMuted}>{" · "}</text>
      <text fg={phaseColor()}>{phaseLabel()}</text>

      <Show when={progress()}>
        <text fg={colors.fgMuted}>{" · "}</text>
        <text fg={colors.fg}>{progress()}</text>
        <text fg={colors.fgMuted}> features </text>
        <text fg={colors.green}>{filledBar()}</text>
        <text fg={colors.fgMuted}>{emptyBar()}</text>
        <text fg={colors.fgMuted}>{" "}</text>
        <text fg={progressPct() === 100 ? colors.green : colors.yellow}>
          {progressPct()}%
        </text>
      </Show>

      <box flexGrow={1} />

      <text fg={agentDisplay().color}>{agentDisplay().icon}</text>
      <text fg={agentDisplay().color}> {agentDisplay().label}</text>

      <Show when={etaText()}>
        <text fg={colors.fgMuted}>{" · "}</text>
        <text fg={colors.fgMuted}>ETA </text>
        <text fg={colors.cyan}>{etaText()}</text>
      </Show>
    </box>
  )
}
