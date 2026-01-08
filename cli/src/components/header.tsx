/** @jsxImportSource @opentui/solid */
import { createMemo, Show } from "solid-js"
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
}

export function Header(props: HeaderProps) {
  const phaseIcon = createMemo(() => PHASE_ICONS[props.phase])
  const phaseColor = createMemo(() => PHASE_COLORS[props.phase])
  const phaseLabel = createMemo(() => PHASE_LABELS[props.phase])

  const progress = createMemo(() => {
    if (props.totalFeatures === 0) return null
    return `${props.featuresComplete}/${props.totalFeatures}`
  })

  const progressPct = createMemo(() => {
    if (props.totalFeatures === 0) return 0
    return Math.round((props.featuresComplete / props.totalFeatures) * 100)
  })

  const etaText = createMemo(() => {
    if (!props.eta || props.eta <= 0) return null
    return formatDuration(props.eta)
  })

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
        <text fg={colors.fgMuted}> features</text>
        <text fg={colors.fgMuted}>{" ("}</text>
        <text fg={progressPct() === 100 ? colors.green : colors.yellow}>
          {progressPct()}%
        </text>
        <text fg={colors.fgMuted}>{")"}</text>
      </Show>

      <box flexGrow={1} />

      <Show when={etaText()}>
        <text fg={colors.fgMuted}>ETA </text>
        <text fg={colors.cyan}>{etaText()}</text>
      </Show>
    </box>
  )
}
