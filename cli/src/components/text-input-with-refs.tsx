/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onMount } from "solid-js"
import type { TextareaRenderable, KeyEvent, BoxRenderable } from "@opentui/core"
import { SyntaxStyle, RGBA } from "@opentui/core"
import fuzzysort from "fuzzysort"
import { colors } from "./colors.js"
import { searchFiles, parseFileReference } from "../util/files.js"
import type { FileReference } from "../state/schema.js"

export interface AutocompleteOption {
  display: string
  path: string
  isDirectory: boolean
}

export interface TextInputWithRefsRef {
  isAutocompleteVisible: () => boolean
  getAnchor: () => BoxRenderable | undefined
  getOptions: () => AutocompleteOption[]
  getSelectedIndex: () => number
  setSelectedIndex: (index: number) => void
  selectOption: (opt: AutocompleteOption) => void
  expandDirectory: (opt: AutocompleteOption) => void
  hideAutocomplete: () => void
}

export interface TextInputWithRefsProps {
  placeholder?: string
  workdir: string
  focused?: boolean
  height?: number
  borderColor?: string
  onSubmit?: (text: string, refs: FileReference[]) => void
  ref?: (ref: TextInputWithRefsRef) => void
}

interface ExtmarkInfo {
  id: number
  path: string
  start: number
  end: number
}

function createSyntaxStyleWithFileRef(): { syntaxStyle: SyntaxStyle; fileStyleId: number } {
  const syntaxStyle = SyntaxStyle.create()
  const fileStyleId = syntaxStyle.registerStyle("extmark.file", {
    fg: RGBA.fromHex(colors.cyan),
  })
  return { syntaxStyle, fileStyleId }
}

export function TextInputWithRefs(props: TextInputWithRefsProps) {
  let textareaRef: TextareaRenderable | undefined
  let inputBoxRef: BoxRenderable | undefined

  const { syntaxStyle, fileStyleId } = createSyntaxStyleWithFileRef()

  const [autocompleteVisible, setAutocompleteVisible] = createSignal(false)
  const [autocompleteQuery, setAutocompleteQuery] = createSignal("")
  const [triggerOffset, setTriggerOffset] = createSignal(0)
  const [selectedOption, setSelectedOption] = createSignal(0)
  const [extmarks, setExtmarks] = createSignal<ExtmarkInfo[]>([])

  const rawOptions = createMemo((): AutocompleteOption[] => {
    if (!autocompleteVisible()) return []
    const query = autocompleteQuery()
    if (!query) {
      return searchFiles("", props.workdir, 20).map((r) => ({
        display: r.path,
        path: r.path,
        isDirectory: r.isDirectory,
      }))
    }

    const { path: queryPath } = parseFileReference(query)
    return searchFiles(queryPath, props.workdir, 20).map((r) => ({
      display: r.path,
      path: r.path,
      isDirectory: r.isDirectory,
    }))
  })

  const options = createMemo((): AutocompleteOption[] => {
    const raw = rawOptions()
    const query = autocompleteQuery()
    
    if (!query) return raw.slice(0, 10)
    
    const results = fuzzysort.go(query, raw, {
      key: "path",
      limit: 10,
    })
    
    return results.map((r) => r.obj)
  })

  createEffect(() => {
    const opts = options()
    if (selectedOption() >= opts.length) {
      setSelectedOption(Math.max(0, opts.length - 1))
    }
  })

  const handleInput = () => {
    if (!textareaRef || !autocompleteVisible()) return

    const cursorOffset = textareaRef.cursorOffset
    const trigger = triggerOffset()

    if (cursorOffset <= trigger) {
      setAutocompleteVisible(false)
      return
    }

    const text = textareaRef.getTextRange(trigger + 1, cursorOffset)
    if (text.includes(" ") || text.includes("\n")) {
      setAutocompleteVisible(false)
      return
    }

    setAutocompleteQuery(text)
    setSelectedOption(0)
  }

  const selectOption = (opt: AutocompleteOption) => {
    if (!textareaRef) return

    const cursorOffset = textareaRef.cursorOffset
    const trigger = triggerOffset()
    const startCursor = textareaRef.logicalCursor
    textareaRef.cursorOffset = trigger
    const triggerCursor = textareaRef.logicalCursor
    textareaRef.cursorOffset = cursorOffset

    textareaRef.deleteRange(triggerCursor.row, triggerCursor.col, startCursor.row, startCursor.col)
    
    const refPath = opt.path.replace(/\/$/, "")
    const insertText = `@${refPath} `
    textareaRef.insertText(insertText)

    const extmarkStart = trigger
    const extmarkEnd = trigger + insertText.length - 1

    const extmarkId = textareaRef.extmarks.create({
      start: extmarkStart,
      end: extmarkEnd,
      virtual: true,
      styleId: fileStyleId,
    })

    setExtmarks((prev) => [...prev, {
      id: extmarkId,
      path: refPath,
      start: extmarkStart,
      end: extmarkEnd,
    }])

    setAutocompleteVisible(false)
  }

  const expandDirectory = (opt: AutocompleteOption) => {
    if (!textareaRef) return

    const cursorOffset = textareaRef.cursorOffset
    const trigger = triggerOffset()
    
    textareaRef.cursorOffset = trigger
    const triggerCursor = textareaRef.logicalCursor
    textareaRef.cursorOffset = cursorOffset
    const endCursor = textareaRef.logicalCursor

    textareaRef.deleteRange(triggerCursor.row, triggerCursor.col, endCursor.row, endCursor.col)
    
    const path = opt.path.replace(/\/$/, "/")
    textareaRef.insertText("@" + path)
    
    setAutocompleteQuery(path)
    setSelectedOption(0)
  }

  const handleKeyDown = (e: KeyEvent) => {
    if (autocompleteVisible()) {
      const opts = options()
      const name = e.name?.toLowerCase()
      const ctrlOnly = e.ctrl && !e.meta && !e.shift

      if (name === "up" || (ctrlOnly && name === "p")) {
        const next = selectedOption() <= 0 ? opts.length - 1 : selectedOption() - 1
        setSelectedOption(next)
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (name === "down" || (ctrlOnly && name === "n")) {
        const next = selectedOption() >= opts.length - 1 ? 0 : selectedOption() + 1
        setSelectedOption(next)
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (name === "escape") {
        setAutocompleteVisible(false)
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (name === "return") {
        const opt = opts[selectedOption()]
        if (opt) {
          selectOption(opt)
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }
      if (name === "tab") {
        const opt = opts[selectedOption()]
        if (opt) {
          if (opt.isDirectory) {
            expandDirectory(opt)
          } else {
            selectOption(opt)
          }
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }
    }

    if (e.name === "@" && !autocompleteVisible()) {
      if (!textareaRef) return
      const cursorOffset = textareaRef.cursorOffset
      const charBefore = cursorOffset === 0 ? " " : textareaRef.getTextRange(cursorOffset - 1, cursorOffset)
      if (/\s/.test(charBefore) || cursorOffset === 0) {
        setTriggerOffset(cursorOffset)
        setAutocompleteVisible(true)
        setAutocompleteQuery("")
        setSelectedOption(0)
      }
    }
  }

  const extractFileRefs = (): FileReference[] => {
    return extmarks().map((em) => {
      const parsed = parseFileReference(em.path)
      return {
        path: parsed.path,
        lineStart: parsed.lineStart,
        lineEnd: parsed.lineEnd,
        displayName: em.path,
      }
    })
  }

  const handleSubmit = () => {
    if (!textareaRef) return
    const text = textareaRef.plainText || ""
    const trimmed = text.trim()
    if (trimmed.length > 0 && props.onSubmit) {
      const refs = extractFileRefs()
      props.onSubmit(trimmed, refs)
      textareaRef.clear()
      setExtmarks([])
    }
  }

  onMount(() => {
    if (textareaRef) {
      textareaRef.syntaxStyle = syntaxStyle
    }
    props.ref?.({
      isAutocompleteVisible: () => autocompleteVisible(),
      getAnchor: () => inputBoxRef,
      getOptions: () => options(),
      getSelectedIndex: () => selectedOption(),
      setSelectedIndex: (index: number) => setSelectedOption(index),
      selectOption,
      expandDirectory,
      hideAutocomplete: () => setAutocompleteVisible(false),
    })
  })

  const height = () => props.height ?? 6
  const borderColor = () => props.borderColor ?? colors.border

  return (
    <box
      ref={(r: BoxRenderable) => (inputBoxRef = r)}
      border={true}
      borderStyle="rounded"
      borderColor={borderColor()}
      backgroundColor={colors.bg}
      height={height()}
      paddingLeft={1}
      paddingRight={1}
    >
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
        onSubmit={handleSubmit}
        onContentChange={handleInput}
        onKeyDown={handleKeyDown}
      />
    </box>
  )
}
