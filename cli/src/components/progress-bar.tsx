/** @jsxImportSource @opentui/solid */
import { For, createMemo } from "solid-js"
import { colors } from "./colors.js"
import { log } from "../util/log.js"

export interface RoundProgressBarProps {
  current: number
  total: number
}

export function RoundProgressBar(props: RoundProgressBarProps) {
  log("progress-bar", "RoundProgressBar render", { current: props.current, total: props.total })
  const slots = createMemo(() => {
    const total = Math.max(1, props.total)
    const current = Math.min(total, Math.max(0, props.current))
    return Array.from({ length: total }, (_, i) => i < current)
  })

  return (
    <box flexDirection="row" gap={1}>
      <For each={slots()}>
        {(filled) => (
          <text fg={filled ? colors.green : colors.fgDark}>
            {filled ? "●" : "○"}
          </text>
        )}
      </For>
    </box>
  )
}

export interface ConvergenceBarProps {
  questionsAsked: number
  minQuestions?: number
  maxQuestions?: number
}

export function ConvergenceBar(props: ConvergenceBarProps) {
  log("progress-bar", "ConvergenceBar render", { questionsAsked: props.questionsAsked })
  const min = () => props.minQuestions ?? 3
  const max = () => props.maxQuestions ?? 10
  const asked = () => props.questionsAsked

  const progress = createMemo(() => {
    const pct = Math.min(100, Math.max(0, (asked() / max()) * 100))
    return Math.round(pct)
  })

  const barWidth = 20
  const filled = createMemo(() => Math.round((progress() / 100) * barWidth))

  const status = createMemo(() => {
    if (asked() < min()) return { text: "warming up", color: colors.yellow }
    if (asked() < max() * 0.7) return { text: "refining", color: colors.cyan }
    return { text: "converging", color: colors.green }
  })

  return (
    <box flexDirection="row" alignItems="center" gap={1}>
      <text fg={colors.fgMuted}>Progress</text>
      <box flexDirection="row">
        <text fg={colors.fgDark}>[</text>
        <text fg={status().color}>
          {"█".repeat(filled())}{"░".repeat(barWidth - filled())}
        </text>
        <text fg={colors.fgDark}>]</text>
      </box>
      <text fg={status().color}>{status().text}</text>
    </box>
  )
}

export interface StatusPillProps {
  label: string
  value: string | number
  color?: string
}

export function StatusPill(props: StatusPillProps) {
  log("progress-bar", "StatusPill render", { label: props.label, value: props.value })
  return (
    <box flexDirection="row" gap={1}>
      <text fg={colors.fgDark}>{props.label}:</text>
      <text fg={props.color ?? colors.fg}>{props.value}</text>
    </box>
  )
}
