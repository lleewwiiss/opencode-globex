import { Schema } from "effect"

export const SignalType = Schema.Literal(
  "ralph-done",
  "ralph-stuck", 
  "ralph-blocked",
  "wiggum-approved",
  "wiggum-rejected",
  "all-complete"
)

export type SignalType = Schema.Schema.Type<typeof SignalType>

export const Signal = Schema.Struct({
  type: SignalType,
  featureId: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  feedback: Schema.optional(Schema.String)
})

export type Signal = Schema.Schema.Type<typeof Signal>

export function parseSignals(output: string): Signal[] {
  const signals: Signal[] = []

  // <ralph>DONE:FEATURE_ID</ralph>
  const ralphDoneRegex = /<ralph>DONE:([^<]+)<\/ralph>/g
  let match = ralphDoneRegex.exec(output)
  while (match) {
    signals.push({
      type: "ralph-done",
      featureId: match[1]
    })
    match = ralphDoneRegex.exec(output)
  }

  // <ralph>STUCK:reason</ralph>
  const ralphStuckRegex = /<ralph>STUCK:([^<]+)<\/ralph>/g
  match = ralphStuckRegex.exec(output)
  while (match) {
    signals.push({
      type: "ralph-stuck",
      reason: match[1]
    })
    match = ralphStuckRegex.exec(output)
  }

  // <ralph>BLOCKED</ralph>
  const ralphBlockedRegex = /<ralph>BLOCKED<\/ralph>/g
  match = ralphBlockedRegex.exec(output)
  while (match) {
    signals.push({
      type: "ralph-blocked"
    })
    match = ralphBlockedRegex.exec(output)
  }

  // <wiggum>APPROVED</wiggum>
  const wiggumApprovedRegex = /<wiggum>APPROVED<\/wiggum>/g
  match = wiggumApprovedRegex.exec(output)
  while (match) {
    signals.push({
      type: "wiggum-approved"
    })
    match = wiggumApprovedRegex.exec(output)
  }

  // <wiggum>REJECTED</wiggum> with feedback extraction
  const wiggumRejectedRegex = /<wiggum>REJECTED<\/wiggum>/g
  match = wiggumRejectedRegex.exec(output)
  while (match) {
    // Extract feedback from text before the signal
    const beforeSignal = output.substring(0, match.index)
    const lines = beforeSignal.split('\n')
    const feedbackLines: string[] = []
    
    // Look backward for feedback content
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (line === '') continue
      if (line.includes('<wiggum>') || line.includes('</wiggum>')) break
      feedbackLines.unshift(line)
      if (feedbackLines.length >= 10) break // Limit feedback size
    }
    
    signals.push({
      type: "wiggum-rejected",
      feedback: feedbackLines.join(' ').trim() || undefined
    })
    match = wiggumRejectedRegex.exec(output)
  }

  // <promise>ALL_FEATURES_COMPLETE</promise>
  const allCompleteRegex = /<promise>ALL_FEATURES_COMPLETE<\/promise>/g
  match = allCompleteRegex.exec(output)
  while (match) {
    signals.push({
      type: "all-complete"
    })
    match = allCompleteRegex.exec(output)
  }

  return signals
}