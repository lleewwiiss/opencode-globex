/** @jsxImportSource @opentui/solid */
import { Show, Match, Switch } from "solid-js"
import { colors } from "./colors.js"
import { SeverityBadge } from "./severity-badge.js"
import { FileReference } from "./file-reference.js"
import { ChoiceInput } from "./choice-input.js"
import { TextInput } from "./text-input.js"
import { MarkdownQuestionView } from "./markdown-view.js"
import type { InterviewQuestion } from "../state/schema.js"

export interface QuestionPanelProps {
  question: InterviewQuestion
  answer: string
  isCustom: boolean
  focused: boolean
  onAnswerChange: (value: string, isCustom: boolean) => void
  onAdvance?: () => void
}

export function QuestionPanel(props: QuestionPanelProps) {
  const handleTextSubmit = (text: string) => {
    props.onAnswerChange(text, true)
  }
  
  const handleChoiceSelect = (value: string, isCustom: boolean) => {
    props.onAnswerChange(value, isCustom)
  }
  
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      gap={1}
    >
      <box flexDirection="row" gap={2} alignItems="center">
        <text fg={colors.cyan}>{props.question.title}</text>
        <SeverityBadge severity={props.question.severity} />
        <Show when={props.question.required}>
          <text fg={colors.yellow}>*required</text>
        </Show>
      </box>
      
      <box marginTop={1}>
        <MarkdownQuestionView markdown={props.question.prompt} />
      </box>
      
      <Show when={props.question.reference}>
        <FileReference reference={props.question.reference!} />
      </Show>
      
      <box marginTop={2} flexGrow={1}>
        <Switch>
          <Match when={props.question.type === "choice" && props.question.options}>
            <ChoiceInput
              options={props.question.options!}
              value={props.answer}
              isCustom={props.isCustom}
              focused={props.focused}
              onSelect={handleChoiceSelect}
              onAdvance={props.onAdvance}
            />
          </Match>
          <Match when={props.question.type === "text"}>
            <box flexDirection="column" width="100%">
              <TextInput
                multiline={true}
                height={6}
                placeholder={props.question.hint ?? "Type your answer..."}
                value={props.answer}
                focused={props.focused}
                borderColor={props.focused ? colors.cyan : colors.border}
                clearOnSubmit={false}
                onInput={(value) => props.onAnswerChange(value, true)}
                onSubmit={handleTextSubmit}
              />
              <Show when={props.question.default && !props.answer}>
                <text fg={colors.fgDark} marginTop={1}>
                  Suggested: {props.question.default}
                </text>
              </Show>
            </box>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
