/** @jsxImportSource @opentui/solid */
import { createMemo, createSignal, createEffect, onCleanup, For } from "solid-js"
import type { ScrollBoxRenderable } from "@opentui/core"
import { colors } from "./colors.js"
import type { TextInputWithRefsRef } from "./text-input-with-refs.js"

export interface AutocompleteOverlayProps {
  inputRef: () => TextInputWithRefsRef | undefined
}

export function AutocompleteOverlay(props: AutocompleteOverlayProps) {
  let scrollRef: ScrollBoxRenderable | undefined

  const [positionTick, setPositionTick] = createSignal(0)

  // Poll for position changes like OpenCode does
  createEffect(() => {
    const input = props.inputRef()
    if (!input) return
    if (!input.isAutocompleteVisible()) return

    let lastPos = { x: 0, y: 0, width: 0 }
    const interval = setInterval(() => {
      const anchor = input.getAnchor()
      if (!anchor) return
      if (anchor.x !== lastPos.x || anchor.y !== lastPos.y || anchor.width !== lastPos.width) {
        lastPos = { x: anchor.x, y: anchor.y, width: anchor.width }
        setPositionTick((t) => t + 1)
      }
    }, 50)

    onCleanup(() => clearInterval(interval))
  })

  const position = createMemo(() => {
    const input = props.inputRef()
    if (!input || !input.isAutocompleteVisible()) return { x: 0, y: 0, width: 0 }

    positionTick() // subscribe to updates
    const anchor = input.getAnchor()
    if (!anchor) return { x: 0, y: 0, width: 0 }

    return {
      x: anchor.x,
      y: anchor.y,
      width: anchor.width,
    }
  })

  const options = createMemo(() => props.inputRef()?.getOptions() ?? [])
  const selectedIndex = createMemo(() => props.inputRef()?.getSelectedIndex() ?? 0)

  const height = createMemo(() => {
    const count = options().length || 1
    const anchor = props.inputRef()?.getAnchor()
    const anchorY = anchor?.y ?? 0
    positionTick()
    return Math.min(8, count, Math.max(1, anchorY))
  })

  const scrollToSelected = (index: number) => {
    if (!scrollRef) return
    const viewportHeight = Math.min(8, options().length)
    const scrollBottom = scrollRef.scrollTop + viewportHeight
    if (index < scrollRef.scrollTop) {
      scrollRef.scrollBy(index - scrollRef.scrollTop)
    } else if (index + 1 > scrollBottom) {
      scrollRef.scrollBy(index + 1 - scrollBottom)
    }
  }

  // Scroll when selection changes
  createEffect(() => {
    const idx = selectedIndex()
    scrollToSelected(idx)
  })

  return (
    <box
      visible={!!props.inputRef()?.isAutocompleteVisible()}
      position="absolute"
      top={position().y - height()}
      left={position().x}
      width={position().width}
      zIndex={100}
      border={["left", "right"]}
      borderColor={colors.border}
      backgroundColor={colors.bgDark}
      customBorderChars={{
        topLeft: "",
        bottomLeft: "",
        vertical: "│",
        topRight: "",
        bottomRight: "",
        horizontal: "",
        bottomT: "",
        topT: "",
        cross: "",
        leftT: "",
        rightT: "",
      }}
    >
      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
        height={height()}
        backgroundColor={colors.bgDark}
        scrollbarOptions={{ visible: false }}
        width="100%"
      >
        <For
          each={options()}
          fallback={
            <box paddingLeft={1} paddingRight={1} width="100%" backgroundColor={colors.bgDark}>
              <text fg={colors.fgDark} bg={colors.bgDark}>No matching files</text>
            </box>
          }
        >
          {(option, index) => (
            <box
              paddingLeft={1}
              paddingRight={1}
              width="100%"
              backgroundColor={index() === selectedIndex() ? colors.blue : colors.bgDark}
            >
              <text
                fg={index() === selectedIndex() ? colors.bgDark : colors.fg}
                bg={index() === selectedIndex() ? colors.blue : colors.bgDark}
                wrapMode="none"
              >
                {option.display}
              </text>
            </box>
          )}
        </For>
      </scrollbox>
    </box>
  )
}
