/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup, Match, Switch, type Setter } from "solid-js"
import { render, useKeyboard, useRenderer } from "@opentui/solid"
import { Header } from "./components/header.js"
import { Log } from "./components/log.js"
import { Footer } from "./components/footer.js"
import { PausedOverlay } from "./components/paused.js"
import { InitScreen, type ActiveProject } from "./components/screens/init.js"
import { BackgroundScreen } from "./components/screens/background.js"
import { InterviewScreen } from "./components/screens/interview.js"
import { ConfirmScreen } from "./components/screens/confirm.js"
import { colors } from "./components/colors.js"
import type { Phase, ToolEvent } from "./state/types.js"
import type { FileReference } from "./state/schema.js"

export type Screen = "init" | "background" | "interview" | "confirm" | "execute"

export interface InitState {
  activeProject?: ActiveProject
}

export interface BackgroundState {
  phase: Phase
  projectName: string
  projectId: string
  statusMessages: string[]
  startedAt: number
}

export interface InterviewState {
  phase: Phase
  projectName: string
  projectId: string
  agentMessage: string
  userInput: string
  round: number
  questionsAsked: number
  startedAt: number
  isWaitingForAgent: boolean
}

export interface ExecuteState {
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
  currentAgent: "idle" | "ralph" | "wiggum"
}

export interface ConfirmState {
  projectName: string
  projectId: string
  totalFeatures: number
  featureCategories: { category: string; count: number }[]
  summary: string
}

export interface AppState {
  screen: Screen
  init: InitState
  background: BackgroundState
  interview: InterviewState
  confirm: ConfirmState
  execute: ExecuteState
}

export interface AppCallbacks {
  onQuit: () => void
  onContinue: (projectId: string) => void
  onNewProject: (description: string, refs: FileReference[]) => void
  onInterviewAnswer?: (answer: string) => void
  onConfirmExecute?: () => void
  onKeyboardEvent?: () => void
  onPauseToggle?: (paused: boolean) => void
}

export interface AppProps {
  initialState: AppState
  callbacks: AppCallbacks
  workdir: string
}

export interface StartAppResult {
  exitPromise: Promise<void>
  setState: Setter<AppState>
}

let globalSetState: Setter<AppState> | null = null

export function createInitialAppState(screen: Screen = "init"): AppState {
  return {
    screen,
    init: {},
    background: {
      phase: "research",
      projectName: "",
      projectId: "",
      statusMessages: [],
      startedAt: Date.now(),
    },
    interview: {
      phase: "research_interview",
      projectName: "",
      projectId: "",
      agentMessage: "",
      userInput: "",
      round: 1,
      questionsAsked: 0,
      startedAt: Date.now(),
      isWaitingForAgent: true,
    },
    confirm: {
      projectName: "",
      projectId: "",
      totalFeatures: 0,
      featureCategories: [],
      summary: "",
    },
    execute: {
      phase: "init",
      projectName: "",
      featuresComplete: 0,
      totalFeatures: 0,
      startedAt: Date.now(),
      eta: undefined,
      events: [],
      isIdle: true,
      paused: false,
      commits: 0,
      linesAdded: 0,
      linesRemoved: 0,
      currentAgent: "idle",
    },
  }
}

export async function startApp(
  initialState: AppState,
  callbacks: AppCallbacks,
  workdir: string = process.cwd()
): Promise<StartAppResult> {
  let exitResolve!: () => void
  const exitPromise = new Promise<void>((resolve) => {
    exitResolve = resolve
  })

  const wrappedCallbacks: AppCallbacks = {
    ...callbacks,
    onQuit: () => {
      callbacks.onQuit()
      exitResolve()
    },
  }

  await render(
    () => (
      <App
        initialState={initialState}
        callbacks={wrappedCallbacks}
        workdir={workdir}
      />
    ),
    {
      targetFps: 30,
      gatherStats: false,
      exitOnCtrlC: false,
      useKittyKeyboard: {},
      useMouse: false,
    }
  )

  if (!globalSetState) {
    throw new Error("TUI state setter not initialized")
  }

  return { exitPromise, setState: globalSetState }
}

function ExecuteScreen(props: {
  state: ExecuteState
  setState: Setter<AppState>
  workdir: string
  onQuit: () => void
  onKeyboardEvent?: () => void
  onPauseToggle?: (paused: boolean) => void
}) {
  const renderer = useRenderer()
  const [elapsed, setElapsed] = createSignal(0)

  const paused = createMemo(() => props.state.paused)
  const phase = createMemo(() => props.state.phase)
  const projectName = createMemo(() => props.state.projectName)
  const featuresComplete = createMemo(() => props.state.featuresComplete)
  const totalFeatures = createMemo(() => props.state.totalFeatures)
  const startedAt = createMemo(() => props.state.startedAt)
  const eta = createMemo(() => props.state.eta)
  const events = createMemo(() => props.state.events)
  const isIdle = createMemo(() => props.state.isIdle)
  const commits = createMemo(() => props.state.commits)
  const linesAdded = createMemo(() => props.state.linesAdded)
  const linesRemoved = createMemo(() => props.state.linesRemoved)
  const currentAgent = createMemo(() => props.state.currentAgent)

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

  let keyboardEventNotified = false

  useKeyboard(
    (key: { name: string; ctrl?: boolean }) => {
      if (!keyboardEventNotified && props.onKeyboardEvent) {
        keyboardEventNotified = true
        props.onKeyboardEvent()
      }

      const keyName = key.name.toLowerCase()

      if (keyName === "q" && !key.ctrl) {
        renderer.setTerminalTitle("")
        renderer.destroy()
        props.onQuit()
      } else if (keyName === "p" && !key.ctrl) {
        const newPaused = !props.state.paused
        props.setState((prev) => ({
          ...prev,
          execute: { ...prev.execute, paused: newPaused },
        }))
        props.onPauseToggle?.(newPaused)
      } else if (keyName === "c" && key.ctrl) {
        renderer.setTerminalTitle("")
        renderer.destroy()
        props.onQuit()
      }
    },
    {}
  )

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.bg}
    >
      <Header
        phase={phase()}
        projectName={projectName()}
        featuresComplete={featuresComplete()}
        totalFeatures={totalFeatures()}
        startedAt={startedAt()}
        eta={eta()}
        currentAgent={currentAgent()}
        paused={paused()}
      />

      <Log events={events()} isIdle={isIdle()} currentAgent={currentAgent()} workdir={props.workdir} />

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

export function App(props: AppProps) {
  const renderer = useRenderer()
  renderer.disableStdoutInterception()

  const [state, setState] = createSignal<AppState>(props.initialState)

  globalSetState = setState

  const screen = createMemo(() => state().screen)

  const handleQuit = () => {
    renderer.setTerminalTitle("")
    renderer.destroy()
    props.callbacks.onQuit()
  }

  return (
    <Switch>
      <Match when={screen() === "init"}>
        <InitScreen
          activeProject={state().init.activeProject}
          workdir={props.workdir}
          onContinue={props.callbacks.onContinue}
          onNewProject={props.callbacks.onNewProject}
          onQuit={handleQuit}
        />
      </Match>
      <Match when={screen() === "background"}>
        <BackgroundScreen
          state={state().background}
          setState={setState}
          onQuit={handleQuit}
        />
      </Match>
      <Match when={screen() === "interview"}>
        <InterviewScreen
          state={() => state().interview}
          setState={setState}
          onQuit={handleQuit}
          onSubmitAnswer={props.callbacks.onInterviewAnswer}
        />
      </Match>
      <Match when={screen() === "confirm"}>
        <ConfirmScreen
          projectName={state().confirm.projectName}
          totalFeatures={state().confirm.totalFeatures}
          featureCategories={state().confirm.featureCategories}
          summary={state().confirm.summary}
          onConfirm={() => props.callbacks.onConfirmExecute?.()}
          onQuit={handleQuit}
        />
      </Match>
      <Match when={screen() === "execute"}>
        <ExecuteScreen
          state={state().execute}
          setState={setState}
          workdir={props.workdir}
          onQuit={handleQuit}
          onKeyboardEvent={props.callbacks.onKeyboardEvent}
          onPauseToggle={props.callbacks.onPauseToggle}
        />
      </Match>
    </Switch>
  )
}

export type { AppState as TUIState }
