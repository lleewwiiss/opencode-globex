/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { colors } from "./colors.js"
import { log } from "../util/log.js"

export interface KeyHint {
  key: string
  label: string
}

export interface Stat {
  label: string
  value: string | number
  color?: string
}

export interface SimpleFooterProps {
  hints: KeyHint[]
  rightText?: string
  stats?: Stat[]
}

export function SimpleFooter(props: SimpleFooterProps) {
  log("simple-footer", "SimpleFooter render", { hintsCount: props.hints?.length })
  return (
    <box
      flexDirection="row"
      width="100%"
      height={2}
      alignItems="center"
      paddingLeft={1}
      paddingRight={1}
      borderStyle="single"
      border={["top"]}
      borderColor={colors.border}
      backgroundColor={colors.bg}
    >
      <For each={props.hints}>
        {(hint, index) => (
          <box flexDirection="row">
            <Show when={index() > 0}>
              <text fg={colors.fgMuted}>{"  "}</text>
            </Show>
            <text fg={colors.fgMuted}>(</text>
            <text fg={colors.fg}>{hint.key}</text>
            <text fg={colors.fgMuted}>) {hint.label}</text>
          </box>
        )}
      </For>

      <box flexGrow={1} />

      <Show when={props.stats && props.stats.length > 0}>
        <box flexDirection="row" gap={2}>
          <For each={props.stats}>
            {(stat) => (
              <box flexDirection="row" gap={1}>
                <text fg={colors.fgDark}>{stat.label}:</text>
                <text fg={stat.color ?? colors.fg}>{stat.value}</text>
              </box>
            )}
          </For>
        </box>
      </Show>

      <Show when={props.rightText}>
        <text fg={colors.fgMuted}>{props.rightText}</text>
      </Show>
    </box>
  )
}
