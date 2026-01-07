import { describe, test, expect } from "bun:test"
import { parseSignals } from "../../src/loop/signals.js"

describe("signals", () => {
  describe("parseSignals", () => {
    test("ralph-done signal extraction", () => {
      const output = "Implementation complete. <ralph>DONE:F001-feature</ralph>"
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({
        type: "ralph-done",
        featureId: "F001-feature"
      })
    })

    test("ralph-stuck signal extraction", () => {
      const output = "Cannot proceed due to missing dependency. <ralph>STUCK:Missing auth module</ralph>"
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({
        type: "ralph-stuck", 
        reason: "Missing auth module"
      })
    })

    test("ralph-blocked detection", () => {
      const output = "External service unavailable. <ralph>BLOCKED</ralph>"
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({
        type: "ralph-blocked"
      })
    })

    test("wiggum-approved detection", () => {
      const output = "Code review passed all checks. <wiggum>APPROVED</wiggum>"
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({
        type: "wiggum-approved"
      })
    })

    test("wiggum-rejected with feedback extraction", () => {
      const output = `Review completed. 
      
Issues found:
- Missing error handling in auth.ts:45
- Type safety violation in utils.ts:12  
- No tests for new functionality

<wiggum>REJECTED</wiggum>`
      
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({
        type: "wiggum-rejected",
        feedback: "Review completed. Issues found: - Missing error handling in auth.ts:45 - Type safety violation in utils.ts:12 - No tests for new functionality"
      })
    })

    test("all-complete detection", () => {
      const output = "All features implemented successfully. <promise>ALL_FEATURES_COMPLETE</promise>"
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({
        type: "all-complete"
      })
    })

    test("multiple signals in one output", () => {
      const output = `
      Feature implementation complete. <ralph>DONE:F001-auth</ralph>
      
      Starting next feature. <ralph>DONE:F002-validation</ralph>
      
      All work finished. <promise>ALL_FEATURES_COMPLETE</promise>
      `
      
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(3)
      expect(signals[0]).toEqual({
        type: "ralph-done",
        featureId: "F001-auth"
      })
      expect(signals[1]).toEqual({
        type: "ralph-done", 
        featureId: "F002-validation"
      })
      expect(signals[2]).toEqual({
        type: "all-complete"
      })
    })

    test("no signals returns empty array", () => {
      const output = "Regular output without any signal markers."
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(0)
      expect(signals).toEqual([])
    })

    test("wiggum-rejected without feedback", () => {
      const output = "<wiggum>REJECTED</wiggum>"
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(1)
      expect(signals[0]).toEqual({
        type: "wiggum-rejected",
        feedback: undefined
      })
    })

    test("multiple identical signals", () => {
      const output = `
      <ralph>DONE:F001</ralph>
      Some other text
      <ralph>DONE:F001</ralph>
      `
      
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(2)
      expect(signals[0]).toEqual({
        type: "ralph-done",
        featureId: "F001"
      })
      expect(signals[1]).toEqual({
        type: "ralph-done",
        featureId: "F001" 
      })
    })

    test("complex wiggum feedback extraction", () => {
      const output = `Code analysis complete.

Critical issues identified:
1. Memory leak in EventEmitter (server.ts:234)
2. SQL injection vulnerability (db/queries.ts:67)
3. Missing input validation (api/users.ts:45)

Additional concerns:
- Performance degradation in large datasets
- Inconsistent error handling patterns

<wiggum>REJECTED</wiggum>

Please address these issues before resubmission.`
      
      const signals = parseSignals(output)
      
      expect(signals).toHaveLength(1)
      expect(signals[0].type).toBe("wiggum-rejected")
      expect(signals[0].feedback).toContain("Critical issues identified")
      expect(signals[0].feedback).toContain("Memory leak")
      expect(signals[0].feedback).toContain("Additional concerns")
      expect(signals[0].feedback).not.toContain("Please address these") // Should stop at signal
    })
  })
})