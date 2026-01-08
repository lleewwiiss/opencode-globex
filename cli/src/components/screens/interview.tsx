/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup, Show } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import type { Setter } from "solid-js"
import { colors } from "../colors.js"
import { SimpleHeader } from "../simple-header.js"
import { SimpleFooter, type KeyHint } from "../simple-footer.js"
import { MarkdownQuestionView } from "../markdown-view.js"
import { TextInput } from "../text-input.js"

import type { AppState, InterviewState } from "../../app.js"
import { log } from "../../util/log.js"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const THINKING_MESSAGES = [
  "Analyzing research findings...",
  "Formulating clarifying questions...",
  "Identifying knowledge gaps...",
  "Preparing next questions...",
]

export interface InterviewScreenProps {
  state: () => InterviewState
  setState: Setter<AppState>
  onQuit: () => void
  onSubmitAnswer?: (answer: string) => void
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export function InterviewScreen(props: InterviewScreenProps) {
  const currentState = () => props.state()
  
  log("interview-screen", "InterviewScreen mounting")

  let renderer: ReturnType<typeof useRenderer>
  try {
    renderer = useRenderer()
    log("interview-screen", "useRenderer succeeded")
  } catch (e) {
    log("interview-screen", "useRenderer FAILED", { error: String(e) })
    throw e
  }

  const [spinnerFrame, setSpinnerFrame] = createSignal(0)
  const [elapsed, setElapsed] = createSignal(0)
  const [thinkingMsgIndex, setThinkingMsgIndex] = createSignal(0)

  log("interview-screen", "Signals created")

  const phase = () => currentState().phase
  const projectName = () => currentState().projectName
  const agentMessage = () => currentState().agentMessage
  const round = () => currentState().round
  const questionsAsked = () => currentState().questionsAsked
  const startedAt = () => currentState().startedAt
  const isWaitingForAgent = () => currentState().isWaitingForAgent

  // Debug: log state changes
  createEffect(() => {
    log("interview-screen", "State updated", {
      round: round(),
      questionsAsked: questionsAsked(),
      isWaitingForAgent: isWaitingForAgent(),
      agentMessageLength: agentMessage()?.length ?? 0,
    })
  })

  // Spinner animation
  createEffect(() => {
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length)
    }, 80)
    onCleanup(() => clearInterval(interval))
  })

  // Thinking message rotation
  createEffect(() => {
    if (!isWaitingForAgent()) return
    const interval = setInterval(() => {
      setThinkingMsgIndex((i) => (i + 1) % THINKING_MESSAGES.length)
    }, 2000)
    onCleanup(() => clearInterval(interval))
  })

  // Elapsed time
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

    if (keyName === "q" && !key.ctrl && isWaitingForAgent()) {
      renderer.setTerminalTitle("")
      renderer.destroy()
      props.onQuit()
    } else if (keyName === "c" && key.ctrl) {
      renderer.setTerminalTitle("")
      renderer.destroy()
      props.onQuit()
    } else if (keyName === "escape" && !isWaitingForAgent()) {
      renderer.setTerminalTitle("")
      renderer.destroy()
      props.onQuit()
    }
  })

  const handleInputSubmit = (text: string) => {
    if (props.onSubmitAnswer) {
      props.onSubmitAnswer(text)
    }
  }

  const keyHints = createMemo((): KeyHint[] => {
    if (isWaitingForAgent()) {
      return [{ key: "q", label: "cancel" }]
    }
    return [
      { key: "enter", label: "submit" },
      { key: "shift+enter", label: "new line" },
      { key: "esc", label: "quit" },
    ]
  })

  const spinner = createMemo(() => SPINNER_FRAMES[spinnerFrame()])
  const thinkingMessage = createMemo(() => THINKING_MESSAGES[thinkingMsgIndex()])



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
        subtitle={`Round ${round()}`}
        rightText={formatElapsed(elapsed())}
      />

      <box
        flexGrow={1}
        flexDirection="column"
        padding={2}
        backgroundColor={colors.bg}
      >
        {/* Agent message area */}
        <box
          flexDirection="column"
          flexGrow={1}
          border={true}
          borderStyle="rounded"
          borderColor={isWaitingForAgent() ? colors.fgDark : colors.border}
          backgroundColor={colors.bg}
          padding={1}
        >
          <Show when={isWaitingForAgent()}>
            <box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} gap={1}>
              <text fg={colors.cyan}>{spinner()} {thinkingMessage()}</text>
              <text fg={colors.fgDark}>The AI is reviewing your research and preparing questions...</text>
            </box>
          </Show>
          <Show when={!isWaitingForAgent() && agentMessage()}>
            <MarkdownQuestionView markdown={agentMessage()} />
          </Show>
        </box>

        {/* User input area */}
        <Show when={!isWaitingForAgent()}>
          <TextInput
            multiline={true}
            height={8}
            placeholder="Type your answer... (Enter to submit, Shift+Enter for new line)"
            borderColor={colors.cyan}
            onSubmit={handleInputSubmit}
          />
        </Show>

      </box>

      <SimpleFooter 
        hints={keyHints()} 
        stats={[
          { label: "Questions", value: questionsAsked(), color: colors.yellow },
        ]}
      />
    </box>
  )
}
