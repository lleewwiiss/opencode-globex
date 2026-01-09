/** @jsxImportSource @opentui/solid */
import { createSignal, createEffect, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { colors } from "./colors.js"
import { TextInput } from "./text-input.js"
import type { InterviewOption } from "../state/schema.js"

export interface ChoiceInputProps {
  options: readonly InterviewOption[]
  value: string
  isCustom: boolean
  focused: boolean
  onSelect: (value: string, isCustom: boolean) => void
}

export function ChoiceInput(props: ChoiceInputProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [customMode, setCustomMode] = createSignal(props.isCustom)
  const [customText, setCustomText] = createSignal(props.isCustom ? props.value : "")
  
  const optionsWithCustom = () => [
    ...props.options,
    { label: "Type your own answer", description: undefined },
  ]
  
  const isCustomOption = (index: number) => index === props.options.length
  
  createEffect(() => {
    if (props.isCustom) {
      setCustomMode(true)
      setCustomText(props.value)
    } else {
      setCustomMode(false)
      const idx = props.options.findIndex(o => o.label === props.value)
      setSelectedIndex(idx >= 0 ? idx : 0)
    }
  })
  
  useKeyboard((key: { name: string; ctrl?: boolean }) => {
    if (!props.focused) return
    
    const keyName = key.name.toLowerCase()
    
    if (customMode()) {
      if (keyName === "escape") {
        setCustomMode(false)
      }
      return
    }
    
    const opts = optionsWithCustom()
    
    if (keyName === "up" || keyName === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (keyName === "down" || keyName === "j") {
      setSelectedIndex((i) => Math.min(opts.length - 1, i + 1))
    } else if (keyName === "return") {
      const idx = selectedIndex()
      if (isCustomOption(idx)) {
        setCustomMode(true)
      } else {
        props.onSelect(opts[idx].label, false)
      }
    }
  })
  
  const handleCustomSubmit = (text: string) => {
    props.onSelect(text, true)
    setCustomMode(false)
  }
  

  
  return (
    <box flexDirection="column" gap={1}>
      <Show when={!customMode()}>
        <For each={optionsWithCustom()}>
          {(option, index) => {
            const isSelected = () => index() === selectedIndex()
            const prefix = () => isSelected() ? "● " : "○ "
            const fgColor = () => isSelected() ? colors.cyan : colors.fg
            
            return (
              <box flexDirection="column">
                <text fg={fgColor()}>
                  {prefix()}{option.label}
                </text>
                <Show when={option.description}>
                  <box marginLeft={2}>
                    <text fg={colors.fgDark}>{option.description}</text>
                  </box>
                </Show>
              </box>
            )
          }}
        </For>
      </Show>
      
      <Show when={customMode()}>
        <box flexDirection="column" gap={1}>
          <text fg={colors.fgDark}>Type your answer (Esc to cancel):</text>
          <TextInput
            multiline={true}
            height={4}
            value={customText()}
            focused={true}
            borderColor={colors.cyan}
            onSubmit={handleCustomSubmit}
          />
        </box>
      </Show>
    </box>
  )
}
