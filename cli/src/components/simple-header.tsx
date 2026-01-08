/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { colors } from "./colors.js"
import type { Phase } from "../state/types.js"
import { log } from "../util/log.js"

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
  research_interview: "research interview",
  plan: "plan",
  plan_interview: "plan interview",
  features: "features",
  execute: "execute",
  complete: "complete",
}

export interface SimpleHeaderProps {
  phase: Phase
  projectName?: string
  rightText?: string
  subtitle?: string
}

export function SimpleHeader(props: SimpleHeaderProps) {
  log("simple-header", "SimpleHeader render", { phase: props.phase, projectName: props.projectName })
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
      <text fg={PHASE_COLORS[props.phase]}>{PHASE_ICONS[props.phase]}</text>
      <text fg={colors.fg}> globex</text>
      <Show when={props.projectName}>
        <text fg={colors.fgMuted}>{" · "}</text>
        <text fg={colors.fg}>{props.projectName}</text>
      </Show>
      <text fg={colors.fgMuted}>{" · "}</text>
      <text fg={PHASE_COLORS[props.phase]}>{PHASE_LABELS[props.phase]}</text>
      <Show when={props.subtitle}>
        <text fg={colors.fgMuted}>{" · "}</text>
        <text fg={colors.fgMuted}>{props.subtitle}</text>
      </Show>

      <box flexGrow={1} />

      <Show when={props.rightText}>
        <text fg={colors.fgMuted}>{props.rightText}</text>
      </Show>
    </box>
  )
}
