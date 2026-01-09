/** @jsxImportSource @opentui/solid */
import { colors } from "./colors.js"
import type { Severity } from "../state/schema.js"

export interface SeverityBadgeProps {
  severity: Severity
}

export function SeverityBadge(props: SeverityBadgeProps) {
  const color = () => {
    switch (props.severity) {
      case "high": return colors.red
      case "medium": return colors.yellow
      case "low": return colors.fgDark
    }
  }
  
  const label = () => props.severity.toUpperCase()
  
  return (
    <text fg={color()}>[{label()}]</text>
  )
}
