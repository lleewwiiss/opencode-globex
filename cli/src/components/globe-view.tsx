/** @jsxImportSource @opentui/solid */
import { createSignal, createEffect, onCleanup, createMemo, For } from "solid-js"
import { generateGlobeFrames, type GlobeCell } from "./globe.js"

interface ColorSpan {
  color: string
  text: string
}

export function batchByColor(cells: GlobeCell[]): ColorSpan[] {
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

export function GlobeLine(props: { cells: GlobeCell[] }) {
  const spans = createMemo(() => batchByColor(props.cells))
  return (
    <box flexDirection="row">
      <For each={spans()}>
        {(span) => <text fg={span.color}>{span.text}</text>}
      </For>
    </box>
  )
}

export interface GlobeViewProps {
  width: number
  height: number
  frameCount?: number
  animationInterval?: number
}

export function GlobeView(props: GlobeViewProps) {
  const frameCount = () => props.frameCount ?? 48
  const animationInterval = () => props.animationInterval ?? 80

  const [globeFrame, setGlobeFrame] = createSignal(0)
  const [globeFrames, setGlobeFrames] = createSignal<GlobeCell[][][]>([])

  // Generate globe frames when dimensions change
  createEffect(() => {
    setGlobeFrames(generateGlobeFrames(frameCount(), props.width, props.height))
  })

  // Animation loop for globe rotation
  createEffect(() => {
    const frames = globeFrames()
    if (frames.length === 0) return
    const interval = setInterval(() => {
      setGlobeFrame((f) => (f + 1) % frames.length)
    }, animationInterval())
    onCleanup(() => clearInterval(interval))
  })

  return (
    <box flexDirection="column">
      <For each={globeFrames()[globeFrame()] ?? []}>
        {(row) => <GlobeLine cells={row} />}
      </For>
    </box>
  )
}
