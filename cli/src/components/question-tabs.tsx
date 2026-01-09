/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { colors } from "./colors.js"
import type { InterviewQuestion } from "../state/schema.js"

export interface QuestionTabsProps {
  questions: readonly InterviewQuestion[]
  activeIndex: number
  answeredIds: Set<string>
  onSelect: (index: number) => void
}

export function QuestionTabs(props: QuestionTabsProps) {
  const isAnswered = (q: InterviewQuestion) => props.answeredIds.has(q.id)
  const isActive = (index: number) => index === props.activeIndex
  const isRequired = (q: InterviewQuestion) => q.required && !props.answeredIds.has(q.id)

  return (
    <box
      flexDirection="row"
      gap={1}
      paddingBottom={1}
    >
      <For each={props.questions}>
        {(question, index) => {
          const active = () => isActive(index())
          const answered = () => isAnswered(question)
          const required = () => isRequired(question)
          
          const bgColor = () => active() ? colors.bgHighlight : colors.bg
          const fgColor = () => {
            if (active()) return colors.cyan
            if (answered()) return colors.green
            if (required()) return colors.yellow
            return colors.fgDark
          }
          
          const prefix = () => answered() ? "✓ " : ""
          const suffix = () => required() ? " *" : ""
          
          return (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={bgColor()}
            >
              <text fg={fgColor()}>
                {prefix()}{question.title}{suffix()}
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}
