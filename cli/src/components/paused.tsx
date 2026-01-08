/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { colors } from "./colors.js"

export type PausedOverlayProps = {
  visible: boolean
}

export function PausedOverlay(props: PausedOverlayProps) {
  return (
    <Show when={props.visible}>
      <box
        position="absolute"
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
        backgroundColor={colors.bgHighlight}
      >
        <box
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          borderStyle="single"
          borderColor={colors.border}
          backgroundColor={colors.bgPanel}
          flexDirection="column"
          alignItems="center"
        >
          <text fg={colors.yellow}>{"\u23F8"} PAUSED</text>
          <text fg={colors.fgMuted}>press p to resume</text>
        </box>
      </box>
    </Show>
  )
}
