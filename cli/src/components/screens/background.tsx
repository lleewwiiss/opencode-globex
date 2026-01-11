/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup, For, Show } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import type { Setter } from "solid-js"
import { colors } from "../colors.js"
import { GlobeView } from "../globe-view.js"
import { SimpleHeader } from "../simple-header.js"
import { SimpleFooter, type KeyHint } from "../simple-footer.js"
import type { Phase } from "../../state/types.js"
import type { AppState, BackgroundState } from "../../app.js"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

const MINI_GLOBE_WIDTH = 24
const MINI_GLOBE_HEIGHT = 12

const PHASE_STATUS_TEXT: Record<Phase, string> = {
  init: "Initializing...",
  research: "Researching codebase...",
  research_interview: "Interviewing...",
  plan: "Creating implementation plan...",
  plan_interview: "Interviewing...",
  features: "Generating feature list...",
  execute: "Executing...",
  complete: "Complete",
}

export interface BackgroundScreenProps {
  state: BackgroundState
  setState: Setter<AppState>
  onQuit: () => void
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export function BackgroundScreen(props: BackgroundScreenProps) {
  const renderer = useRenderer()
  const [spinnerFrame, setSpinnerFrame] = createSignal(0)
  const [elapsed, setElapsed] = createSignal(0)
  const terminalDimensions = useTerminalDimensions()

  const phase = createMemo(() => props.state.phase)
  const projectName = createMemo(() => props.state.projectName)
  const statusMessages = createMemo(() => props.state.statusMessages)
  const startedAt = createMemo(() => props.state.startedAt)

  const showMiniGlobe = createMemo(() => {
    const dims = terminalDimensions()
    return dims.height >= MINI_GLOBE_HEIGHT + 12 && dims.width >= MINI_GLOBE_WIDTH + 4
  })

  createEffect(() => {
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length)
    }, 80)
    onCleanup(() => clearInterval(interval))
  })

  createEffect(() => {
    const start = startedAt()
    if (!start) return

    const tick = () => {
      setElapsed(Date.now() - start)
    }
    tick()
    const interval = setInterval(tick, 1000)
    onCleanup(() => clearInterval(interval))
  })

  useKeyboard((key: { name: string; ctrl?: boolean }) => {
    const keyName = key.name.toLowerCase()

    if (keyName === "q" && !key.ctrl) {
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
    { key: "q", label: "cancel" },
  ])

  const spinner = createMemo(() => SPINNER_FRAMES[spinnerFrame()])
  const statusText = createMemo(() => PHASE_STATUS_TEXT[phase()])

  const recentMessages = createMemo(() => {
    const msgs = statusMessages()
    return msgs.slice(-5)
  })

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.bg}
    >
      <SimpleHeader
        phase={phase()}
        projectName={projectName()}
        rightText={formatElapsed(elapsed())}
      />

      <box
        flexGrow={1}
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingLeft={2}
        paddingRight={2}
      >
        <Show when={showMiniGlobe()}>
          <box marginBottom={1}>
            <GlobeView width={MINI_GLOBE_WIDTH} height={MINI_GLOBE_HEIGHT} />
          </box>
        </Show>
        <box flexDirection="row" alignItems="center" marginBottom={2}>
          <text fg={colors.cyan}>{spinner()}</text>
          <text fg={colors.fg}>{" "}{statusText()}</text>
        </box>

        <box flexDirection="column" alignItems="center" marginTop={1}>
          <For each={recentMessages()}>
            {(msg) => (
              <text fg={colors.fgMuted}>{msg}</text>
            )}
          </For>
        </box>
      </box>

      <SimpleFooter hints={keyHints()} rightText={formatElapsed(elapsed())} />
    </box>
  )
}
