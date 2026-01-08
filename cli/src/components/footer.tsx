/** @jsxImportSource @opentui/solid */
import { colors } from "./colors"
import { formatDuration } from "../util/time"

export type FooterProps = {
  commits: number
  elapsed: number
  paused: boolean
  linesAdded: number
  linesRemoved: number
}

export function Footer(props: FooterProps) {
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
      <text fg={colors.fgMuted}>(</text>
      <text fg={colors.fg}>q</text>
      <text fg={colors.fgMuted}>) interrupt  (</text>
      <text fg={colors.fg}>p</text>
      <text fg={colors.fgMuted}>) {props.paused ? "resume" : "pause"}</text>

      <box flexGrow={1} />

      <text fg={colors.green}>+{props.linesAdded}</text>
      <text fg={colors.fgMuted}> / </text>
      <text fg={colors.red}>-{props.linesRemoved}</text>
      <text fg={colors.fgMuted}>
        {" "}{"\u00B7"}{" "}{props.commits} commits {"\u00B7"} {formatDuration(props.elapsed)}
      </text>
    </box>
  )
}
