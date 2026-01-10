/** @jsxImportSource @opentui/solid */
import { For, Switch, Match } from "solid-js"
import { link } from "@opentui/core"
import { colors } from "./colors.js"
import { log } from "../util/log.js"

type BlockType = "question" | "bullet" | "code" | "note" | "paragraph" | "header" | "table"

interface TableData {
  headers: string[]
  rows: string[][]
}

interface Block {
  type: BlockType
  text: string
  index?: number
  lines?: string[]
  level?: number
  table?: TableData
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s\-:|]+\|?$/.test(line) && line.includes("-")
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  const noOuterPipes = trimmed.replace(/^\|/, "").replace(/\|$/, "")
  return noOuterPipes.split("|").map((cell) => cell.trim())
}

function parseMarkdownToBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n")
  const blocks: Block[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
  let currentQuestionIndex = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    
    // Code block fence
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({ type: "code", text: "", lines: codeLines })
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      i++
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      i++
      continue
    }

    const trimmed = line.trim()
    if (!trimmed) {
      i++
      continue
    }

    // Table detection: line with | and next line is separator
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) {
      const headers = parseTableRow(trimmed)
      i += 2 // Skip header and separator
      const rows: string[][] = []
      
      while (i < lines.length) {
        const rowLine = lines[i].trim()
        if (!rowLine || !rowLine.includes("|")) break
        if (isTableSeparator(rowLine)) {
          i++
          continue
        }
        rows.push(parseTableRow(rowLine))
        i++
      }
      
      blocks.push({ type: "table", text: "", table: { headers, rows } })
      continue
    }

    // Headers (## or **)
    const headerMatch = trimmed.match(/^#{1,3}\s+(.+)$/)
    if (headerMatch) {
      const level = (trimmed.match(/^#+/) || [""])[0].length
      blocks.push({ type: "header", text: headerMatch[1], level })
      i++
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
      i++
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
      i++
      continue
    }

    // Bullets (- or *)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      blocks.push({ type: "bullet", text: bulletMatch[1] })
      i++
      continue
    }

    // Blockquotes (>)
    const noteMatch = trimmed.match(/^>\s*(.+)$/)
    if (noteMatch) {
      blocks.push({ type: "note", text: noteMatch[1] })
      i++
      continue
    }

    // Plain paragraph
    blocks.push({ type: "paragraph", text: trimmed })
    i++
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

interface TextSegment {
  type: "text" | "link"
  text: string
  url?: string
}

function parseTextWithLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: "link", text: match[1], url: match[2] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: "text", text }]
}

function RichText(props: { text: string; color?: string }) {
  const segments = () => parseTextWithLinks(stripInlineFormatting(props.text))
  const textColor = () => props.color ?? colors.fg

  return (
    <text>
      <For each={segments()}>
        {(segment) => (
          <Switch>
            <Match when={segment.type === "link"}>
              <span style={{ fg: colors.blue, underline: true }}>
                {link(segment.url!)(segment.text)}
              </span>
            </Match>
            <Match when={segment.type === "text"}>
              <span style={{ fg: textColor() }}>{segment.text}</span>
            </Match>
          </Switch>
        )}
      </For>
    </text>
  )
}

function QuestionRow(props: { index: number; text: string }) {
  return (
    <box flexDirection="column" paddingTop={1}>
      <box flexDirection="row" gap={1}>
        <text><span style={{ fg: colors.yellow }}>{props.index}.</span></text>
        <RichText text={props.text} />
      </box>
    </box>
  )
}

function BulletRow(props: { text: string }) {
  return (
    <box flexDirection="row" gap={1} paddingLeft={2}>
      <text><span style={{ fg: colors.cyan }}>•</span></text>
      <RichText text={props.text} />
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
      <text><span style={{ fg: colors.blue }}>▍</span></text>
      <RichText text={props.text} color={colors.fgDark} />
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
      <RichText text={props.text} />
    </box>
  )
}

function TableBlock(props: { table: TableData }) {
  const colWidths = () => {
    const widths: number[] = []
    const headers = props.table.headers.map(stripInlineFormatting)
    headers.forEach((h, i) => {
      widths[i] = Math.max(widths[i] ?? 0, h.length)
    })
    for (const row of props.table.rows) {
      row.forEach((cell, i) => {
        const clean = stripInlineFormatting(cell)
        widths[i] = Math.max(widths[i] ?? 0, clean.length)
      })
    }
    return widths
  }

  const formatCell = (text: string, width: number) => {
    return stripInlineFormatting(text).padEnd(width)
  }

  const separator = () => {
    return colWidths()
      .map((w) => "─".repeat(w + 2))
      .join("┼")
  }

  const cols = colWidths()

  return (
    <box flexDirection="column" paddingLeft={2} marginTop={1} marginBottom={1}>
      <text fg={colors.fgDark}>┌─{separator().replace(/┼/g, "─┬─")}─┐</text>
      <box flexDirection="row">
        <text fg={colors.fgDark}>│ </text>
        <For each={props.table.headers}>
          {(header, i) => (
            <>
              <text fg={colors.cyan}>
                <b>{formatCell(header, cols[i()])}</b>
              </text>
              <text fg={colors.fgDark}>{i() < props.table.headers.length - 1 ? " │ " : ""}</text>
            </>
          )}
        </For>
        <text fg={colors.fgDark}> │</text>
      </box>
      <text fg={colors.fgDark}>├─{separator()}─┤</text>
      <For each={props.table.rows}>
        {(row) => (
          <box flexDirection="row">
            <text fg={colors.fgDark}>│ </text>
            <For each={row}>
              {(cell, i) => (
                <>
                  <text fg={colors.fg}>{formatCell(cell, cols[i()])}</text>
                  <text fg={colors.fgDark}>{i() < row.length - 1 ? " │ " : ""}</text>
                </>
              )}
            </For>
            <text fg={colors.fgDark}> │</text>
          </box>
        )}
      </For>
      <text fg={colors.fgDark}>└─{separator().replace(/┼/g, "─┴─")}─┘</text>
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
            <Match when={block.type === "table" && block.table}>
              <TableBlock table={block.table!} />
            </Match>
          </Switch>
        )}
      </For>
    </box>
  )
}
