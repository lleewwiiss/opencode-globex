/** @jsxImportSource @opentui/solid */
import { SyntaxStyle, RGBA } from "@opentui/core"
import { colors } from "./colors.js"

function createMarkdownSyntaxStyle(): SyntaxStyle {
  const toRGBA = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return RGBA.fromInts(r, g, b)
  }

  return SyntaxStyle.fromTheme([
    {
      scope: ["default"],
      style: { foreground: toRGBA(colors.fg) },
    },
    {
      scope: ["markup.heading", "markup.heading.1", "markup.heading.2", "markup.heading.3"],
      style: { foreground: toRGBA(colors.cyan), bold: true },
    },
    {
      scope: ["markup.bold", "markup.strong"],
      style: { foreground: toRGBA(colors.fg), bold: true },
    },
    {
      scope: ["markup.italic"],
      style: { foreground: toRGBA(colors.fgMuted), italic: true },
    },
    {
      scope: ["markup.list"],
      style: { foreground: toRGBA(colors.blue) },
    },
    {
      scope: ["markup.quote"],
      style: { foreground: toRGBA(colors.fgDark), italic: true },
    },
    {
      scope: ["markup.raw", "markup.raw.block", "markup.raw.inline"],
      style: { foreground: toRGBA(colors.green) },
    },
    {
      scope: ["markup.link"],
      style: { foreground: toRGBA(colors.blue), underline: true },
    },
    {
      scope: ["markup.link.url"],
      style: { foreground: toRGBA(colors.fgDark) },
    },
    {
      scope: ["string"],
      style: { foreground: toRGBA(colors.green) },
    },
    {
      scope: ["keyword"],
      style: { foreground: toRGBA(colors.purple) },
    },
    {
      scope: ["comment"],
      style: { foreground: toRGBA(colors.fgDark), italic: true },
    },
    {
      scope: ["punctuation"],
      style: { foreground: toRGBA(colors.fgDark) },
    },
  ])
}

const markdownSyntax = createMarkdownSyntaxStyle()

export interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
  return (
    <code
      filetype="markdown"
      content={props.content}
      syntaxStyle={markdownSyntax}
      fg={colors.fg}
      drawUnstyledText={false}
    />
  )
}
