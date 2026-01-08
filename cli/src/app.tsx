/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { Header } from "./components/header.js"
import { Log, getEventKey } from "./components/log.js"
import { Footer } from "./components/footer.js"
import { PausedOverlay } from "./components/paused.js"
import { colors } from "./components/colors.js"
import type { Phase, ToolEvent } from "./state/types.js"

export interface TUIState {
  phase: Phase
  projectName: string
  featuresComplete: number
  totalFeatures: number
  startedAt?: number
  eta?: number
  events: ToolEvent[]
  isIdle: boolean
  paused: boolean
  commits: number
  linesAdded: number
  linesRemoved: number
}

export interface AppProps {
  initialState: TUIState
  onQuit: () => void
}

export function App(props: AppProps) {
  const [state, setState] = createSignal<TUIState>(props.initialState)
  const [elapsed, setElapsed] = createSignal(0)

  const paused = createMemo(() => state().paused)
  const phase = createMemo(() => state().phase)
  const projectName = createMemo(() => state().projectName)
  const featuresComplete = createMemo(() => state().featuresComplete)
  const totalFeatures = createMemo(() => state().totalFeatures)
  const startedAt = createMemo(() => state().startedAt)
  const eta = createMemo(() => state().eta)
  const events = createMemo(() => state().events)
  const isIdle = createMemo(() => state().isIdle)
  const commits = createMemo(() => state().commits)
  const linesAdded = createMemo(() => state().linesAdded)
  const linesRemoved = createMemo(() => state().linesRemoved)

  // Elapsed time ticker
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

  // Keyboard handling
  useKeyboard(
    (key: { name: string }) => {
      if (key.name === "q") {
        props.onQuit()
      } else if (key.name === "p") {
        setState((prev) => ({ ...prev, paused: !prev.paused }))
      }
    },
    {}
  )

  // Expose state setter for external updates
  ;(globalThis as Record<string, unknown>).__tuiSetState = setState

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.bgDark}
    >
      <Header
        phase={phase()}
        projectName={projectName()}
        featuresComplete={featuresComplete()}
        totalFeatures={totalFeatures()}
        startedAt={startedAt()}
        eta={eta()}
      />

      <Log events={events()} isIdle={isIdle()} />

      <Footer
        commits={commits()}
        elapsed={elapsed()}
        paused={paused()}
        linesAdded={linesAdded()}
        linesRemoved={linesRemoved()}
      />

      <PausedOverlay visible={paused()} />
    </box>
  )
}

export type { TUIState as AppTUIState }
