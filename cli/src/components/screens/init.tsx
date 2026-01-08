/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import type { SelectOption } from "@opentui/core"
import { colors } from "../colors.js"
import { SimpleHeader } from "../simple-header.js"
import { SimpleFooter, type KeyHint } from "../simple-footer.js"
import { TextInput } from "../text-input.js"

export interface ActiveProject {
  id: string
  name: string
  phase: string
}

export interface InitScreenProps {
  activeProject?: ActiveProject
  onContinue: (projectId: string) => void
  onNewProject: (description: string) => void
  onQuit: () => void
}

type InitStep = "select" | "input"

// Placeholder for future animated logo frames
const LOGO_FRAMES: string[] = []

export function InitScreen(props: InitScreenProps) {
  const hasActiveProject = createMemo(() => !!props.activeProject)
  const [step, setStep] = createSignal<InitStep>(hasActiveProject() ? "select" : "input")
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [description, setDescription] = createSignal("")
  const [logoFrame, setLogoFrame] = createSignal(0)

  // Animation loop for logo frames (cycles at 100ms)
  createEffect(() => {
    const interval = setInterval(() => {
      setLogoFrame((f) => (f + 1) % Math.max(1, LOGO_FRAMES.length))
    }, 100)
    onCleanup(() => clearInterval(interval))
  })

  const selectOptions = createMemo((): SelectOption[] => {
    if (!props.activeProject) return []
    return [
      {
        name: `Continue "${props.activeProject.name}"`,
        description: `Resume at ${props.activeProject.phase} phase`,
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
        if (hasActiveProject()) {
          setStep("select")
          setDescription("")
        } else {
          props.onQuit()
        }
      }
    }
  })

  const handleInputSubmit = (value: string) => {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      props.onNewProject(trimmed)
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
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingLeft={2}
        paddingRight={2}
      >
        {/* Logo */}
        <box flexDirection="column" alignItems="center" marginBottom={2}>
          <text fg={colors.purple}>{"╭──────────────────╮"}</text>
          <text fg={colors.purple}>
            {"│"}
            <span style={{ fg: colors.cyan }}>{" ◈ "}</span>
            <span style={{ fg: colors.fg }}>{"GLOBEX"}</span>
            {"         │"}
          </text>
          <text fg={colors.purple}>{"╰──────────────────╯"}</text>
        </box>

        {/* Select Step */}
        <Show when={step() === "select" && hasActiveProject()}>
          <box flexDirection="column" width={50} marginTop={1}>
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
          <box flexDirection="column" width={60} marginTop={1}>
            <text fg={colors.fgMuted} marginBottom={1}>
              Describe your project:
            </text>

            <TextInput
              placeholder="Add authentication using JWT tokens..."
              value={description()}
              onInput={(value) => setDescription(value)}
              onSubmit={handleInputSubmit}
            />

            <text fg={colors.fgDark} marginTop={1}>
              Be specific about what you want to build.
            </text>
          </box>
        </Show>
      </box>

      <SimpleFooter hints={keyHints()} />
    </box>
  )
}
