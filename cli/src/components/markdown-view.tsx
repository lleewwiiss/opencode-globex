/** @jsxImportSource @opentui/solid */
import { For, Switch, Match } from "solid-js"
import { colors } from "./colors.js"
import { log } from "../util/log.js"

type BlockType = "question" | "bullet" | "code" | "note" | "paragraph" | "header"

interface Block {
  type: BlockType
  text: string
  index?: number
  lines?: string[]
  level?: number
}

function parseMarkdownToBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n")
  const blocks: Block[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
  let currentQuestionIndex = 0

  for (const line of lines) {
    // Code block fence
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({ type: "code", text: "", lines: codeLines })
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    const trimmed = line.trim()
    if (!trimmed) continue

    // Headers (## or **)
    const headerMatch = trimmed.match(/^#{1,3}\s+(.+)$/)
    if (headerMatch) {
      const level = (trimmed.match(/^#+/) || [""])[0].length
      blocks.push({ type: "header", text: headerMatch[1], level })
      continue
    }

    // Bold headers (**text**)
    const boldHeaderMatch = trimmed.match(/^\*\*(\d+)\.\s*(.+?)\*\*$/)
    if (boldHeaderMatch) {
      currentQuestionIndex = parseInt(boldHeaderMatch[1], 10)
      blocks.push({ 
        type: "question", 
        text: boldHeaderMatch[2], 
        index: currentQuestionIndex 
      })
      continue
    }

    // Numbered questions (1. Question text)
    const questionMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (questionMatch) {
      currentQuestionIndex = parseInt(questionMatch[1], 10)
      blocks.push({ 
        type: "question", 
        text: questionMatch[2], 
        index: currentQuestionIndex 
      })
      continue
    }

    // Bullets (- or *)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      blocks.push({ type: "bullet", text: bulletMatch[1] })
      continue
    }

    // Blockquotes (>)
    const noteMatch = trimmed.match(/^>\s*(.+)$/)
    if (noteMatch) {
      blocks.push({ type: "note", text: noteMatch[1] })
      continue
    }

    // Plain paragraph
    blocks.push({ type: "paragraph", text: trimmed })
  }

  // Handle unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: "code", text: "", lines: codeLines })
  }

  return blocks
}

function stripInlineFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
}

function QuestionRow(props: { index: number; text: string }) {
  return (
    <box flexDirection="column" paddingTop={1}>
      <box flexDirection="row" gap={1}>
        <text><span style={{ fg: colors.yellow }}>{props.index}.</span> <span style={{ fg: colors.fg, bold: true }}>{stripInlineFormatting(props.text)}</span></text>
      </box>
    </box>
  )
}

function BulletRow(props: { text: string }) {
  return (
    <box flexDirection="row" gap={1} paddingLeft={2}>
      <text><span style={{ fg: colors.cyan }}>•</span> <span style={{ fg: colors.fg }}>{stripInlineFormatting(props.text)}</span></text>
    </box>
  )
}

function CodeBlock(props: { lines: string[] }) {
  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor={colors.cyan}
      backgroundColor={colors.bgHighlight}
      padding={1}
    >
      <For each={props.lines}>
        {(line) => <text fg={colors.fgDark}>{line}</text>}
      </For>
    </box>
  )
}

function NoteRow(props: { text: string }) {
  return (
    <box flexDirection="row" gap={1} paddingLeft={2}>
      <text><span style={{ fg: colors.blue }}>▍</span> <span style={{ fg: colors.fgDark }}>{stripInlineFormatting(props.text)}</span></text>
    </box>
  )
}

function HeaderRow(props: { text: string; level: number }) {
  const color = props.level === 1 ? colors.purple : colors.cyan
  return (
    <box paddingBottom={1}>
      <text><span style={{ fg: color, bold: true }}>{props.text}</span></text>
    </box>
  )
}

function ParagraphRow(props: { text: string }) {
  return (
    <box paddingLeft={2}>
      <text fg={colors.fg}>{stripInlineFormatting(props.text)}</text>
    </box>
  )
}

export function MarkdownQuestionView(props: { markdown: string }) {
  log("markdown-view", "MarkdownQuestionView render", {
    markdownType: typeof props.markdown,
    markdownLength: typeof props.markdown === "string" ? props.markdown.length : "N/A",
  })
  const blocks = () => {
    if (typeof props.markdown !== "string" || !props.markdown.trim()) {
      log("markdown-view", "Empty or invalid markdown, returning empty blocks")
      return [] as Block[]
    }
    const parsed = parseMarkdownToBlocks(props.markdown)
    log("markdown-view", "Parsed blocks", { count: parsed.length })
    return parsed
  }

  return (
    <box flexDirection="column" width="100%">
      <For each={blocks()}>
        {(block) => (
          <Switch>
            <Match when={block.type === "header"}>
              <HeaderRow text={block.text} level={block.level || 2} />
            </Match>
            <Match when={block.type === "question"}>
              <QuestionRow index={block.index || 0} text={block.text} />
            </Match>
            <Match when={block.type === "bullet"}>
              <BulletRow text={block.text} />
            </Match>
            <Match when={block.type === "code"}>
              <CodeBlock lines={block.lines || []} />
            </Match>
            <Match when={block.type === "note"}>
              <NoteRow text={block.text} />
            </Match>
            <Match when={block.type === "paragraph"}>
              <ParagraphRow text={block.text} />
            </Match>
          </Switch>
        )}
      </For>
    </box>
  )
}
