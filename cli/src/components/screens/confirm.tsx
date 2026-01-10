/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, For, Show } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { colors } from "../colors.js"
import { SimpleHeader } from "../simple-header.js"
import { SimpleFooter, type KeyHint } from "../simple-footer.js"

export interface ConfirmScreenProps {
  projectName: string
  totalFeatures: number
  featureCategories: { category: string; count: number }[]
  summary: string
  onConfirm: () => void
  onQuit: () => void
}

export function ConfirmScreen(props: ConfirmScreenProps) {
  const renderer = useRenderer()
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const actionOptions = [
    { label: "Start execution loop", value: "confirm" },
    { label: "Cancel and quit", value: "cancel" },
  ]

  useKeyboard((key: { name: string; ctrl?: boolean }) => {
    const keyName = key.name.toLowerCase()

    if (keyName === "up" || keyName === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (keyName === "down" || keyName === "j") {
      setSelectedIndex((i) => Math.min(actionOptions.length - 1, i + 1))
    } else if (keyName === "return" || keyName === "enter") {
      const selected = actionOptions[selectedIndex()]
      if (selected?.value === "confirm") {
        props.onConfirm()
      } else {
        renderer.setTerminalTitle("")
        renderer.destroy()
        props.onQuit()
      }
    } else if (keyName === "q" && !key.ctrl) {
      renderer.setTerminalTitle("")
      renderer.destroy()
      props.onQuit()
    } else if (keyName === "c" && key.ctrl) {
      renderer.setTerminalTitle("")
      renderer.destroy()
      props.onQuit()
    }
  })

  const keyHints = createMemo((): KeyHint[] => [
    { key: "↑↓", label: "navigate" },
    { key: "enter", label: "select" },
    { key: "q", label: "quit" },
  ])

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.bg}
    >
      <SimpleHeader phase="features" projectName={props.projectName} />

      <box
        flexGrow={1}
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingLeft={2}
        paddingRight={2}
      >
        {/* Summary box */}
        <box
          flexDirection="column"
          border={true}
          borderStyle="rounded"
          borderColor={colors.purple}
          padding={2}
          width={70}
        >
          <text><span style={{ fg: colors.fg, bold: true }}>Ready to Execute</span></text>
          <box height={1} />
          
          {/* Agent summary */}
          <Show when={props.summary}>
            <text fg={colors.fg}>{props.summary}</text>
            <box height={1} />
          </Show>

          <box flexDirection="row" gap={2}>
            <text fg={colors.fgMuted}>Total features:</text>
            <text fg={colors.yellow}>{props.totalFeatures}</text>
          </box>

          <box height={1} />

          <text fg={colors.fgMuted}>By category:</text>
          <For each={props.featureCategories}>
            {(cat) => (
              <box flexDirection="row" gap={2} paddingLeft={2}>
                <text fg={colors.cyan}>•</text>
                <text fg={colors.fg}>{cat.category}:</text>
                <text fg={colors.yellow}>{cat.count}</text>
              </box>
            )}
          </For>

          <box height={2} />

          <text fg={colors.fgDark}>
            Ralph will implement each feature. Chief Wiggum will validate.
          </text>
          <text fg={colors.fgDark}>
            You can pause with 'p' or quit with 'q' during execution.
          </text>
        </box>

        <box height={2} />

        {/* Action options */}
        <box flexDirection="column" width={40}>
          <For each={actionOptions}>
            {(option, index) => {
              const isSelected = () => selectedIndex() === index()
              return (
                <box
                  flexDirection="row"
                  paddingLeft={2}
                  paddingRight={2}
                  paddingTop={1}
                  paddingBottom={1}
                  backgroundColor={isSelected() ? colors.bgHighlight : colors.bg}
                >
                  <text fg={isSelected() ? colors.cyan : colors.fgMuted}>
                    {isSelected() ? "▸ " : "  "}
                    {option.label}
                  </text>
                </box>
              )
            }}
          </For>
        </box>
      </box>

      <SimpleFooter hints={keyHints()} />
    </box>
  )
}
