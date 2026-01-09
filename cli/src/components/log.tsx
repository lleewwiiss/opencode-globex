/** @jsxImportSource @opentui/solid */
import { For, Match, Switch, createEffect, createSignal, onCleanup } from "solid-js"
import { colors, TOOL_ICONS } from "./colors"
import { formatDuration } from "../util/time"
import type { ToolEvent } from "../state/types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const DEFAULT_ICON = "\u2699"

export function getEventKey(event: ToolEvent): string {
  return `${event.iteration}-${event.timestamp}`
}

function getToolColor(icon: string | undefined): string {
  if (!icon) return colors.fg

  if (icon === TOOL_ICONS.read) return colors.blue
  if (icon === TOOL_ICONS.write || icon === TOOL_ICONS.edit) return colors.green
  if (icon === TOOL_ICONS.glob || icon === TOOL_ICONS.grep) return colors.yellow
  if (icon === TOOL_ICONS.task || icon === TOOL_ICONS.ralph) return colors.purple
  if (icon === TOOL_ICONS.wiggum) return colors.yellow
  if (
    icon === TOOL_ICONS.webfetch ||
    icon === TOOL_ICONS.websearch ||
    icon === TOOL_ICONS.codesearch
  )
    return colors.cyan
  if (icon === TOOL_ICONS.bash) return colors.fgMuted
  return colors.fg
}

export type LogProps = {
  events: ToolEvent[]
  isIdle: boolean
  currentAgent: "idle" | "ralph" | "wiggum"
  workdir: string
}

function SpinnerInline(props: { frame: number; currentAgent: "idle" | "ralph" | "wiggum" }) {
  const message = () => {
    if (props.currentAgent === "wiggum") return "Chief Wiggum is keeping him in line..."
    return "Ralph is working..."
  }

  return (
    <box width="100%" flexDirection="row" paddingTop={1} paddingLeft={1}>
      <text fg={colors.cyan}>{SPINNER_FRAMES[props.frame]}</text>
      <text fg={colors.fgMuted}> {message()}</text>
    </box>
  )
}

function SeparatorEvent(props: { event: ToolEvent }) {
  const isComplete = () => props.event.duration !== undefined
  const durationText = () =>
    props.event.duration !== undefined
      ? formatDuration(props.event.duration)
      : "running"
  const commitCount = () => props.event.commitCount ?? 0
  const commitText = () =>
    `${commitCount()} commit${commitCount() !== 1 ? "s" : ""}`
  const statusText = () => {
    if (props.event.passed === true) return "✓ passed"
    if (props.event.passed === false) return "✗ failed"
    return null
  }
  const statusColor = () => {
    if (props.event.passed === true) return colors.green
    if (props.event.passed === false) return colors.red
    return colors.fg
  }

  return (
    <box width="100%" paddingTop={1} paddingBottom={1} flexDirection="row">
      <text fg={colors.fgMuted}>{"── "}</text>
      <text fg={colors.fg}>iteration {props.event.iteration}</text>
      <text fg={colors.fgMuted}>{" ────────────── "}</text>
      {isComplete() && statusText() ? (
        <>
          <text fg={statusColor()}>{statusText()}</text>
          <text fg={colors.fgMuted}>{" · "}</text>
        </>
      ) : null}
      <text fg={colors.fg}>{durationText()}</text>
      {isComplete() ? (
        <>
          <text fg={colors.fgMuted}>{" · "}</text>
          <text fg={colors.fg}>{commitText()}</text>
        </>
      ) : null}
      <text fg={colors.fgMuted}>{" ──"}</text>
    </box>
  )
}

function ToolEventItem(props: { event: ToolEvent; workdir: string }) {
  const icon = () => props.event.icon || DEFAULT_ICON
  const iconColor = () => getToolColor(props.event.icon)

  return (
    <box width="100%" flexDirection="row" paddingLeft={1}>
      <text fg={iconColor()}>{icon()}</text>
      <text fg={colors.fg}> {props.event.text}</text>
    </box>
  )
}

export function Log(props: LogProps) {
  // Lift spinner animation state to Log level to avoid signal creation during reactive updates
  const [frame, setFrame] = createSignal(0)
  let intervalRef: ReturnType<typeof setInterval> | null = null

  createEffect(() => {
    if (props.isIdle) {
      if (intervalRef) {
        clearInterval(intervalRef)
        intervalRef = null
      }
    } else {
      if (!intervalRef) {
        intervalRef = setInterval(() => {
          setFrame((f) => (f + 1) % SPINNER_FRAMES.length)
        }, 120)
      }
    }
  })

  onCleanup(() => {
    if (intervalRef) {
      clearInterval(intervalRef)
      intervalRef = null
    }
  })

  return (
    <scrollbox
      flexGrow={1}
      stickyScroll={true}
      stickyStart="bottom"
      rootOptions={{
        backgroundColor: colors.bg,
      }}
      viewportOptions={{
        backgroundColor: colors.bg,
      }}
      verticalScrollbarOptions={{
        visible: true,
        trackOptions: {
          backgroundColor: colors.border,
        },
      }}
    >
      <For each={props.events}>
        {(event) => (
          <Switch>
            <Match when={event.type === "spinner"}>
              <SpinnerInline frame={frame()} currentAgent={props.currentAgent} />
            </Match>
            <Match when={event.type === "separator"}>
              <SeparatorEvent event={event} />
            </Match>
            <Match when={event.type === "tool"}>
              <ToolEventItem event={event} workdir={props.workdir} />
            </Match>
          </Switch>
        )}
      </For>
    </scrollbox>
  )
}
