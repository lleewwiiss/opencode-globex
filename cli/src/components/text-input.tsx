/** @jsxImportSource @opentui/solid */
import { colors } from "./colors.js"
import type { TextareaRenderable } from "@opentui/core"

export interface TextInputProps {
  placeholder?: string
  value?: string
  focused?: boolean
  onInput?: (value: string) => void
  onSubmit?: (value: string) => void
  multiline?: boolean
  height?: number
  borderColor?: string
  clearOnSubmit?: boolean
}

/**
 * Shared text input component with consistent styling and padding.
 * Supports both single-line (input) and multi-line (textarea) modes.
 */
export function TextInput(props: TextInputProps) {
  // eslint-disable-next-line no-unassigned-vars -- Solid.js ref pattern: assigned via ref prop
  let textareaRef: TextareaRenderable | undefined

  const handleTextareaSubmit = () => {
    if (!textareaRef) return
    const text = textareaRef.getSelectedText() || textareaRef.getTextRange(0, 10000)
    const trimmed = text.trim()
    if (trimmed.length > 0 && props.onSubmit) {
      props.onSubmit(trimmed)
      if (props.clearOnSubmit ?? true) {
        textareaRef.clear()
      }
    }
  }

  const borderColor = () => props.borderColor ?? colors.border
  const height = () => props.height ?? (props.multiline ? 6 : 3)

  return (
    <box
      border={true}
      borderStyle="rounded"
      borderColor={borderColor()}
      backgroundColor={colors.bg}
      height={height()}
      paddingLeft={1}
      paddingRight={1}
    >
      {props.multiline ? (
        <textarea
          ref={textareaRef}
          placeholder={props.placeholder}
          focused={props.focused ?? true}
          backgroundColor={colors.bg}
          focusedBackgroundColor={colors.bg}
          textColor={colors.fg}
          wrapMode="word"
          keyBindings={[
            { name: "enter", action: "submit" },
            { name: "enter", shift: true, action: "newline" },
          ]}
          onSubmit={handleTextareaSubmit}
        />
      ) : (
        <input
          placeholder={props.placeholder}
          value={props.value}
          focused={props.focused ?? true}
          onInput={props.onInput}
          onSubmit={props.onSubmit}
          backgroundColor={colors.bg}
          focusedBackgroundColor={colors.bgHighlight}
          textColor={colors.fg}
          placeholderColor={colors.fgDark}
          cursorColor={colors.cyan}
        />
      )}
    </box>
  )
}
