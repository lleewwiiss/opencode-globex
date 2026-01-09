/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { colors } from "./colors.js"
import type { InterviewFileRef } from "../state/schema.js"

export interface FileReferenceProps {
  reference: InterviewFileRef
  expanded?: boolean
}

export function FileReference(props: FileReferenceProps) {
  const expanded = () => props.expanded ?? true
  const chevron = () => expanded() ? "▾" : "▸"
  
  return (
    <box flexDirection="column" marginTop={1}>
      <text fg={colors.blue}>
        {chevron()} {props.reference.file}:{props.reference.lines}
      </text>
      <Show when={expanded()}>
        <box
          marginLeft={2}
          marginTop={1}
          paddingLeft={1}
        >
          <text fg={colors.fgMuted}>│ {props.reference.quote}</text>
        </box>
      </Show>
    </box>
  )
}
