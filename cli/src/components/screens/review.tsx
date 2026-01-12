/** @jsxImportSource @opentui/solid */
import { createSignal, createEffect, onCleanup, Show, For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { ScrollBoxRenderable, ScrollAcceleration } from "@opentui/core"
import type { Setter } from "solid-js"
import { colors } from "../colors.js"
import { SimpleHeader } from "../simple-header.js"
import { SimpleFooter, type KeyHint } from "../simple-footer.js"
import { TextInput } from "../text-input.js"
import { MarkdownRenderer } from "../markdown-renderer.js"
import type { AppState, ReviewState } from "../../app.js"
import { log } from "../../util/log.js"

export interface ReviewScreenProps {
  state: () => ReviewState
  setState: Setter<AppState>
  onQuit: () => void
  onConfirm: () => void
  onFeedback: (feedback: string) => void
}

interface ChatMessage {
  role: "user" | "agent"
  content: string
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

class FixedSpeedScroll implements ScrollAcceleration {
  constructor(private speed: number) {}
  tick(_now?: number): number {
    return this.speed
  }
  reset(): void {}
}

const scrollAccel = new FixedSpeedScroll(3)

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export function ReviewScreen(props: ReviewScreenProps) {
  const currentState = () => props.state()
  
  log("review-screen", "ReviewScreen mounting")

  const dimensions = useTerminalDimensions()

  const [elapsed, setElapsed] = createSignal(0)
  const [spinnerFrame, setSpinnerFrame] = createSignal(0)
  
  let scrollRef: ScrollBoxRenderable | undefined

  const phase = () => currentState().phase
  const projectName = () => currentState().projectName
  const artifactContent = () => currentState().artifactContent
  const artifactName = () => currentState().artifactName
  const chatHistory = () => currentState().chatHistory
  const isWaitingForAgent = () => currentState().isWaitingForAgent
  const startedAt = () => currentState().startedAt

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

  createEffect(() => {
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length)
    }, 80)
    onCleanup(() => clearInterval(interval))
  })

  useKeyboard((key: { name: string; ctrl?: boolean }) => {
    const keyName = key.name.toLowerCase()

    if (keyName === "c" && key.ctrl) {
      props.onQuit()
    } else if (keyName === "escape" && !isWaitingForAgent()) {
      props.onQuit()
    } else if (keyName === "y" && !isWaitingForAgent()) {
      props.onConfirm()
    }
    
    if (scrollRef) {
      const pageSize = Math.floor(dimensions().height * 0.5)
      if (keyName === "up" || keyName === "k") {
        scrollRef.scrollBy(-3)
      } else if (keyName === "down" || keyName === "j") {
        scrollRef.scrollBy(3)
      } else if (keyName === "pageup") {
        scrollRef.scrollBy(-pageSize)
      } else if (keyName === "pagedown" || keyName === "space") {
        scrollRef.scrollBy(pageSize)
      } else if (keyName === "home" || keyName === "g") {
        scrollRef.scrollTo(0)
      } else if (keyName === "end") {
        scrollRef.scrollTo(scrollRef.scrollHeight)
      }
    }
  })

  const handleFeedbackSubmit = (text: string) => {
    if (text.trim()) {
      props.onFeedback(text.trim())
    }
  }

  const keyHints = (): KeyHint[] => {
    if (isWaitingForAgent()) {
      return [{ key: "ctrl+c", label: "cancel" }]
    }
    return [
      { key: "y", label: "confirm & proceed" },
      { key: "j/k", label: "scroll" },
      { key: "enter", label: "submit feedback" },
      { key: "esc", label: "quit" },
    ]
  }

  const spinner = () => SPINNER_FRAMES[spinnerFrame()]

  const phaseLabel = () => {
    if (phase() === "research_interview") return "Research Review"
    if (phase() === "plan_interview") return "Plan Review"
    return "Review"
  }

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
        subtitle={phaseLabel()}
        rightText={formatElapsed(elapsed())}
      />

      <box
        flexGrow={1}
        flexDirection="column"
        padding={1}
        backgroundColor={colors.bg}
      >
        <box flexDirection="row" gap={1} marginBottom={1}>
          <text fg={colors.cyan}>Reviewing:</text>
          <text fg={colors.fg}>{artifactName()}</text>
        </box>

        <text fg={colors.fgDark} marginBottom={1}>
          Read the artifact below. Press Y to confirm and proceed, or provide feedback to refine.
        </text>

        <scrollbox
          ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
          flexGrow={1}
          flexShrink={1}
          border={true}
          borderStyle="rounded"
          borderColor={colors.border}
          backgroundColor={colors.bg}
          scrollAcceleration={scrollAccel}
          viewportOptions={{
            padding: 1,
            backgroundColor: colors.bg,
          }}
          verticalScrollbarOptions={{
            visible: true,
            paddingLeft: 1,
          }}
        >
          <MarkdownRenderer content={artifactContent()} />
        </scrollbox>

        <Show when={chatHistory().length > 0}>
          <box
            flexDirection="column"
            flexShrink={0}
            marginTop={1}
            border={true}
            borderStyle="rounded"
            borderColor={colors.fgDark}
            padding={1}
            height={8}
          >
            <text fg={colors.fgDark} marginBottom={1}>Conversation:</text>
            <scrollbox
              flexGrow={1}
              stickyScroll={true}
              stickyStart="bottom"
              viewportOptions={{ backgroundColor: colors.bg }}
            >
              <For each={chatHistory()}>
                {(msg: ChatMessage) => (
                  <box flexDirection="row" gap={1}>
                    <text fg={msg.role === "user" ? colors.cyan : colors.yellow}>
                      {msg.role === "user" ? "You:" : "Agent:"}
                    </text>
                    <text fg={colors.fg}>{msg.content}</text>
                  </box>
                )}
              </For>
            </scrollbox>
          </box>
        </Show>

        <box marginTop={1} flexShrink={0}>
          <Show when={isWaitingForAgent()}>
            <box
              border={true}
              borderStyle="rounded"
              borderColor={colors.fgDark}
              padding={1}
              height={4}
            >
              <text fg={colors.cyan}>{spinner()} Agent is reviewing your feedback...</text>
            </box>
          </Show>
          <Show when={!isWaitingForAgent()}>
            <TextInput
              multiline={true}
              height={4}
              placeholder="Type feedback or refinements... (Enter to submit, Y to confirm and proceed)"
              borderColor={colors.cyan}
              focused={true}
              onSubmit={handleFeedbackSubmit}
            />
          </Show>
        </box>
      </box>

      <SimpleFooter hints={keyHints()} stats={[]} />
    </box>
  )
}
