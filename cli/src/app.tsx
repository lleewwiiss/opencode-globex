/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup, type Setter } from "solid-js"
import { render, useKeyboard, useRenderer } from "@opentui/solid"
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
  onKeyboardEvent?: () => void
}

export interface StartAppResult {
  exitPromise: Promise<void>
  setState: Setter<TUIState>
}

let globalSetState: Setter<TUIState> | null = null

export async function startApp(
  initialState: TUIState,
  onQuit: () => void,
  onKeyboardEvent?: () => void
): Promise<StartAppResult> {
  let exitResolve!: () => void
  const exitPromise = new Promise<void>((resolve) => {
    exitResolve = resolve
  })

  const wrappedOnQuit = () => {
    onQuit()
    exitResolve()
  }

  await render(
    () => (
      <App
        initialState={initialState}
        onQuit={wrappedOnQuit}
        onKeyboardEvent={onKeyboardEvent}
      />
    ),
    {
      targetFps: 30,
      gatherStats: false,
      exitOnCtrlC: false,
      useKittyKeyboard: {},
    }
  )

  if (!globalSetState) {
    throw new Error("TUI state setter not initialized")
  }

  return { exitPromise, setState: globalSetState }
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

  // Track if keyboard event callback was fired
  let keyboardEventNotified = false

  // Keyboard handling
  useKeyboard(
    (key: { name: string }) => {
      if (!keyboardEventNotified && props.onKeyboardEvent) {
        keyboardEventNotified = true
        props.onKeyboardEvent()
      }

      if (key.name === "q") {
        props.onQuit()
      } else if (key.name === "p") {
        setState((prev) => ({ ...prev, paused: !prev.paused }))
      }
    },
    {}
  )

  // Export state setter for external access
  globalSetState = setState

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
