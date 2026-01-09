/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup, Show } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import type { Setter } from "solid-js"
import { colors } from "../colors.js"
import { SimpleHeader } from "../simple-header.js"
import { SimpleFooter, type KeyHint } from "../simple-footer.js"
import { MarkdownQuestionView } from "../markdown-view.js"
import { TextInput } from "../text-input.js"
import { QuestionTabs } from "../question-tabs.js"
import { QuestionPanel } from "../question-panel.js"

import type { AppState, InterviewState } from "../../app.js"
import type { InterviewAnswersPayload, InterviewAnswer } from "../../state/schema.js"
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
  onSubmitAnswer?: (payload: InterviewAnswersPayload) => void
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
  const [activeQuestionIndex, setActiveQuestionIndex] = createSignal(0)
  const [answers, setAnswers] = createSignal<Map<string, { answer: string; isCustom: boolean }>>(new Map())

  log("interview-screen", "Signals created")

  const phase = () => currentState().phase
  const projectName = () => currentState().projectName
  const agentMessage = () => currentState().agentMessage
  const roundNum = () => currentState().round
  const questionsAsked = () => currentState().questionsAsked
  const startedAt = () => currentState().startedAt
  const isWaitingForAgent = () => currentState().isWaitingForAgent
  const currentRound = () => currentState().currentRound
  
  const hasStructuredQuestions = () => {
    const round = currentRound()
    return round && round.questions && round.questions.length > 0
  }
  
  const questions = () => currentRound()?.questions ?? []
  const activeQuestion = () => questions()[activeQuestionIndex()]
  
  const answeredIds = createMemo(() => {
    const ids = new Set<string>()
    for (const [id, data] of answers()) {
      if (data.answer.trim().length > 0) {
        ids.add(id)
      }
    }
    return ids
  })
  
  const answeredCount = createMemo(() => answeredIds().size)
  const totalQuestions = createMemo(() => questions().length)
  
  const allRequiredAnswered = createMemo(() => {
    const qs = questions()
    const ans = answers()
    return qs.every(q => {
      if (!q.required) return true
      const a = ans.get(q.id)
      return a && a.answer.trim().length > 0
    })
  })

  createEffect(() => {
    const round = currentRound()
    if (round) {
      setActiveQuestionIndex(0)
      setAnswers(new Map())
    }
  })

  createEffect(() => {
    log("interview-screen", "State updated", {
      round: roundNum(),
      questionsAsked: questionsAsked(),
      isWaitingForAgent: isWaitingForAgent(),
      hasStructuredQuestions: hasStructuredQuestions(),
      questionCount: questions().length,
    })
  })

  createEffect(() => {
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length)
    }, 80)
    onCleanup(() => clearInterval(interval))
  })

  createEffect(() => {
    if (!isWaitingForAgent()) return
    const interval = setInterval(() => {
      setThinkingMsgIndex((i) => (i + 1) % THINKING_MESSAGES.length)
    }, 2000)
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

  useKeyboard((key: { name: string; ctrl?: boolean; shift?: boolean }) => {
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
    } else if (keyName === "tab" && !isWaitingForAgent() && hasStructuredQuestions()) {
      const qs = questions()
      if (key.shift) {
        setActiveQuestionIndex((i) => (i - 1 + qs.length) % qs.length)
      } else {
        setActiveQuestionIndex((i) => (i + 1) % qs.length)
      }
    } else if (keyName === "return" && key.ctrl && !isWaitingForAgent() && hasStructuredQuestions()) {
      handleSubmitRound()
    }
  })

  const handleAnswerChange = (questionId: string, value: string, isCustom: boolean) => {
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(questionId, { answer: value, isCustom })
      return next
    })
  }

  const handleSubmitRound = () => {
    if (!props.onSubmitAnswer) return
    if (!allRequiredAnswered()) {
      log("interview-screen", "Cannot submit - required questions not answered")
      return
    }
    
    const phaseVal = phase() as "research_interview" | "plan_interview"
    const round = roundNum()
    const qs = questions()
    const ans = answers()
    
    const answerList: InterviewAnswer[] = qs.map((q) => {
      const a = ans.get(q.id)
      return {
        questionId: q.id,
        answer: a?.answer ?? "",
        isCustom: a?.isCustom ?? true,
      }
    })
    
    const payload: InterviewAnswersPayload = {
      phase: phaseVal,
      round,
      answers: answerList,
    }
    
    props.onSubmitAnswer(payload)
  }

  const handleLegacySubmit = (text: string) => {
    if (!props.onSubmitAnswer) return
    
    const phaseVal = phase() as "research_interview" | "plan_interview"
    const round = roundNum()
    
    const payload: InterviewAnswersPayload = {
      phase: phaseVal,
      round,
      answers: [{
        questionId: `r${round}-q1`,
        answer: text,
        isCustom: true,
      }],
    }
    props.onSubmitAnswer(payload)
  }

  const keyHints = createMemo((): KeyHint[] => {
    if (isWaitingForAgent()) {
      return [{ key: "q", label: "cancel" }]
    }
    if (hasStructuredQuestions()) {
      return [
        { key: "tab", label: "next question" },
        { key: "shift+tab", label: "prev question" },
        { key: "ctrl+enter", label: "submit round" },
        { key: "esc", label: "quit" },
      ]
    }
    return [
      { key: "enter", label: "submit" },
      { key: "shift+enter", label: "new line" },
      { key: "esc", label: "quit" },
    ]
  })

  const spinner = createMemo(() => SPINNER_FRAMES[spinnerFrame()])
  const thinkingMessage = createMemo(() => THINKING_MESSAGES[thinkingMsgIndex()])

  const roundTitle = createMemo(() => {
    const round = currentRound()
    return round?.roundTitle ?? `Round ${roundNum()}`
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
        subtitle={roundTitle()}
        rightText={formatElapsed(elapsed())}
      />

      <box
        flexGrow={1}
        flexDirection="column"
        padding={2}
        backgroundColor={colors.bg}
      >
        <Show when={hasStructuredQuestions()}>
          <box flexDirection="column" flexGrow={1}>
            <text fg={colors.fgDark} marginBottom={1}>
              Use Tab/Shift+Tab to switch questions. You can edit any answer before submitting.
            </text>
            
            <QuestionTabs
              questions={questions()}
              activeIndex={activeQuestionIndex()}
              answeredIds={answeredIds()}
              onSelect={setActiveQuestionIndex}
            />
            
            <box
              flexDirection="column"
              flexGrow={1}
              border={true}
              borderStyle="rounded"
              borderColor={isWaitingForAgent() ? colors.fgDark : colors.border}
              backgroundColor={colors.bg}
              padding={1}
            >
              <Show when={activeQuestion()}>
                <QuestionPanel
                  question={activeQuestion()!}
                  answer={answers().get(activeQuestion()!.id)?.answer ?? ""}
                  isCustom={answers().get(activeQuestion()!.id)?.isCustom ?? false}
                  focused={!isWaitingForAgent()}
                  onAnswerChange={(value, isCustom) => 
                    handleAnswerChange(activeQuestion()!.id, value, isCustom)
                  }
                />
              </Show>
            </box>
            
            <box marginTop={1} flexDirection="row" justifyContent="space-between" alignItems="center">
              <text fg={colors.fgDark}>
                {answeredCount()}/{totalQuestions()} answered
              </text>
              <Show when={!isWaitingForAgent()}>
                <text fg={allRequiredAnswered() ? colors.green : colors.fgDark}>
                  {allRequiredAnswered() ? "[Ctrl+Enter to submit]" : "[Answer required questions]"}
                </text>
              </Show>
            </box>
            
            <Show when={isWaitingForAgent()}>
              <box marginTop={1} flexDirection="row" alignItems="center" gap={1}>
                <text fg={colors.cyan}>{spinner()} {thinkingMessage()}</text>
              </box>
            </Show>
          </box>
        </Show>

        <Show when={isWaitingForAgent() && !hasStructuredQuestions()}>
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="rounded"
            borderColor={colors.fgDark}
            backgroundColor={colors.bg}
            padding={1}
          >
            <box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} gap={1}>
              <text fg={colors.cyan}>{spinner()} {thinkingMessage()}</text>
              <text fg={colors.fgDark}>The AI is reviewing your research and preparing questions...</text>
            </box>
          </box>
        </Show>

        <Show when={!isWaitingForAgent() && !hasStructuredQuestions()}>
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="rounded"
            borderColor={colors.border}
            backgroundColor={colors.bg}
            padding={1}
          >
            <Show when={agentMessage()}>
              <MarkdownQuestionView markdown={agentMessage()} />
            </Show>
          </box>

          <TextInput
            multiline={true}
            height={8}
            placeholder="Type your answer... (Enter to submit, Shift+Enter for new line)"
            borderColor={colors.cyan}
            onSubmit={handleLegacySubmit}
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
