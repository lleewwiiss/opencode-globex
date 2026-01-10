/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup, Show, For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { SelectOption } from "@opentui/core"
import { colors } from "../colors.js"
import { SimpleHeader } from "../simple-header.js"
import { SimpleFooter, type KeyHint } from "../simple-footer.js"
import { TextInputWithRefs, type TextInputWithRefsRef } from "../text-input-with-refs.js"
import { AutocompleteOverlay } from "../autocomplete-overlay.js"
import type { FileReference } from "../../state/schema.js"

export interface ActiveProject {
  id: string
  name: string
  phase: string
  worktreePath?: string
}

export interface InitScreenProps {
  activeProject?: ActiveProject
  workdir: string
  onContinue: (projectId: string) => void
  onNewProject: (description: string, refs: FileReference[]) => void
  onQuit: () => void
}

type InitStep = "select" | "input"

import { generateGlobeFrames, computeGlobeDimensions, type GlobeCell } from "../globe.js"

interface ColorSpan {
  color: string
  text: string
}

function batchByColor(cells: GlobeCell[]): ColorSpan[] {
  const spans: ColorSpan[] = []
  for (const cell of cells) {
    const last = spans[spans.length - 1]
    if (last && last.color === cell.color) {
      last.text += cell.char
    } else {
      spans.push({ color: cell.color, text: cell.char })
    }
  }
  return spans
}

function GlobeLine(props: { cells: GlobeCell[] }) {
  const spans = createMemo(() => batchByColor(props.cells))
  return (
    <box flexDirection="row">
      <For each={spans()}>
        {(span) => <text fg={span.color}>{span.text}</text>}
      </For>
    </box>
  )
}

// Reserved space: header ~2, footer ~2, title ~2, margins ~2
const RESERVED_VERTICAL = 8
const RESERVED_HORIZONTAL = 4
// Extra space needed for menu in vertical layout
const MENU_HEIGHT = 10

export function InitScreen(props: InitScreenProps) {
  const hasActiveProject = createMemo(() => !!props.activeProject)
  const [step, setStep] = createSignal<InitStep>(hasActiveProject() ? "select" : "input")
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  
  const [inputRef, setInputRef] = createSignal<TextInputWithRefsRef | undefined>()
  
  const [globeFrame, setGlobeFrame] = createSignal(0)
  const [globeFrames, setGlobeFrames] = createSignal<GlobeCell[][][]>([])
  const terminalDimensions = useTerminalDimensions()

  // Compute globe dimensions and layout mode based on terminal size
  const globeDimensions = createMemo(() => {
    const dims = terminalDimensions()
    // In compact mode, globe shares horizontal space, so give it less reserved
    const verticalReserved = RESERVED_VERTICAL
    return computeGlobeDimensions(dims.width, dims.height, verticalReserved, RESERVED_HORIZONTAL)
  })

  // Compact layout when globe + menu won't fit vertically
  const isCompact = createMemo(() => {
    const dims = terminalDimensions()
    const globeDims = globeDimensions()
    if (!globeDims) return true // No globe = definitely compact
    const neededHeight = RESERVED_VERTICAL + globeDims.height + MENU_HEIGHT
    return dims.height < neededHeight
  })

  // Regenerate globe frames when dimensions change
  createEffect(() => {
    const dims = globeDimensions()
    if (dims) {
      setGlobeFrames(generateGlobeFrames(48, dims.width, dims.height))
    } else {
      setGlobeFrames([])
    }
  })

  // Animation loop for globe rotation (80ms per frame for smooth spin)
  createEffect(() => {
    const frames = globeFrames()
    if (frames.length === 0) return
    const interval = setInterval(() => {
      setGlobeFrame((f) => (f + 1) % frames.length)
    }, 80)
    onCleanup(() => clearInterval(interval))
  })

  const selectOptions = createMemo((): SelectOption[] => {
    if (!props.activeProject) return []
    const continueDesc = props.activeProject.worktreePath
      ? `${props.activeProject.phase} · ${props.activeProject.worktreePath}`
      : `Resume at ${props.activeProject.phase} phase`
    return [
      {
        name: `Continue "${props.activeProject.name}"`,
        description: continueDesc,
        value: "continue",
      },
      {
        name: "Start a new project",
        description: "Enter a project description",
        value: "new",
      },
    ]
  })

  const keyHints = createMemo((): KeyHint[] => {
    if (step() === "select") {
      return [
        { key: "↑↓", label: "navigate" },
        { key: "enter", label: "select" },
        { key: "q", label: "quit" },
      ]
    }
    return [
      { key: "@", label: "add file" },
      { key: "enter", label: "submit" },
      { key: "esc", label: hasActiveProject() ? "back" : "quit" },
    ]
  })

  useKeyboard((key: { name: string; ctrl?: boolean }) => {
    const keyName = key.name.toLowerCase()

    if (keyName === "q" && !key.ctrl && step() === "select") {
      props.onQuit()
      return
    }

    if (keyName === "c" && key.ctrl) {
      props.onQuit()
      return
    }

    if (step() === "select") {
      if (keyName === "up" || keyName === "k") {
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (keyName === "down" || keyName === "j") {
        setSelectedIndex((i) => Math.min(selectOptions().length - 1, i + 1))
      } else if (keyName === "return" || keyName === "enter") {
        const selected = selectOptions()[selectedIndex()]
        if (selected?.value === "continue" && props.activeProject) {
          props.onContinue(props.activeProject.id)
        } else if (selected?.value === "new") {
          setStep("input")
        }
      }
    } else if (step() === "input") {
      if (keyName === "escape") {
        // Don't handle ESC if autocomplete is visible - let it close the autocomplete first
        if (inputRef()?.isAutocompleteVisible()) {
          return
        }
        if (hasActiveProject()) {
          setStep("select")
        } else {
          props.onQuit()
        }
      }
    }
  })

  const handleInputSubmit = (text: string, refs: FileReference[]) => {
    const trimmed = text.trim()
    if (trimmed.length > 0) {
      props.onNewProject(trimmed, refs)
    }
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.bg}
    >
      <SimpleHeader phase="init" />

      <box
        flexGrow={1}
        flexDirection={isCompact() ? "row" : "column"}
        alignItems="center"
        justifyContent="center"
        paddingLeft={2}
        paddingRight={2}
        gap={isCompact() ? 4 : 0}
      >
        {/* Animated Globe Logo */}
        <Show when={globeFrames().length > 0}>
          <box flexDirection="column" alignItems="center" marginBottom={isCompact() ? 0 : 1}>
            <box flexDirection="column">
              <For each={globeFrames()[globeFrame()] ?? []}>
                {(row) => <GlobeLine cells={row} />}
              </For>
            </box>
            <text fg={colors.fg}>GLOBEX CORPORATION</text>
            <text fg={colors.fgDark}>Wiggum driven development; No vibes allowed.</text>
          </box>
        </Show>
        {/* Fallback when globe is too small */}
        <Show when={globeFrames().length === 0}>
          <box flexDirection="column" alignItems="center" marginBottom={isCompact() ? 0 : 1}>
            <text fg={colors.green}>GLOBEX</text>
            <text fg={colors.fg}>CORPORATION</text>
            <text fg={colors.fgDark}>Wiggum driven development; No vibes allowed.</text>
          </box>
        </Show>

        {/* Menu Section */}
        <box flexDirection="column" alignItems={isCompact() ? "flex-start" : "center"} justifyContent="center">
          {/* Select Step */}
          <Show when={step() === "select" && hasActiveProject()}>
            <box flexDirection="column" width={50} marginTop={isCompact() ? 0 : 1}>
              <text fg={colors.fgMuted} marginBottom={1}>
                What would you like to do?
              </text>

              <select
                options={selectOptions()}
                focused={true}
                height={6}
                width={50}
                onChange={(index) => setSelectedIndex(index)}
                onSelect={(index) => {
                  const selected = selectOptions()[index]
                  if (selected?.value === "continue" && props.activeProject) {
                    props.onContinue(props.activeProject.id)
                  } else if (selected?.value === "new") {
                    setStep("input")
                  }
                }}
              />
            </box>
          </Show>

          {/* Input Step */}
          <Show when={step() === "input"}>
            <box flexDirection="column" width={60} marginTop={isCompact() ? 0 : 1}>
              <text fg={colors.fgMuted} marginBottom={1}>
                Describe your project:
              </text>

              <TextInputWithRefs
                ref={(r) => setInputRef(r)}
                placeholder="Add authentication using JWT tokens... (@ to reference files)"
                workdir={props.workdir}
                onSubmit={handleInputSubmit}
              />

              <text fg={colors.fgDark} marginTop={1}>
                Be specific. Type @ to reference files.
              </text>
            </box>
          </Show>
        </box>
      </box>

      <SimpleFooter hints={keyHints()} />

      <AutocompleteOverlay inputRef={inputRef} />
    </box>
  )
}
