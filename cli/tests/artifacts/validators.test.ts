import { describe, test, expect } from "bun:test"
import {
  validateFeaturesJson,
  validateCitationsJson,
  validateRisksJson,
} from "../../src/artifacts/validators.js"

describe("validateFeaturesJson", () => {
  test("valid features.json returns success with data", () => {
    const valid = JSON.stringify({
      features: [
        {
          id: "feat-1",
          description: "Test feature",
          passes: false,
          priority: 1,
          dependencies: [],
        },
      ],
    })

    const result = validateFeaturesJson(valid)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.features).toHaveLength(1)
    expect(result.data?.features[0].id).toBe("feat-1")
  })

  test("missing required field returns errors with field path", () => {
    const invalid = JSON.stringify({
      features: [
        {
          id: "feat-1",
          description: "Missing passes and priority",
          dependencies: [],
        },
      ],
    })

    const result = validateFeaturesJson(invalid)

    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
    expect(result.errors!.some(e => e.path.includes("features.0"))).toBe(true)
  })

  test("malformed JSON returns parse error at root", () => {
    const malformed = "{ not valid json"

    const result = validateFeaturesJson(malformed)

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0].path).toBe("(root)")
    expect(result.errors![0].message).toContain("Invalid JSON")
  })
})

describe("validateCitationsJson", () => {
  test("valid citations.json returns success with data", () => {
    const valid = JSON.stringify({
      citations: [
        {
          claim: "The system uses X",
          path: "src/index.ts",
          lineStart: 10,
          lineEnd: 20,
        },
      ],
    })

    const result = validateCitationsJson(valid)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.citations).toHaveLength(1)
    expect(result.data?.citations[0].claim).toBe("The system uses X")
  })

  test("missing required field returns errors with field path", () => {
    const invalid = JSON.stringify({
      citations: [
        {
          claim: "Missing path and lines",
        },
      ],
    })

    const result = validateCitationsJson(invalid)

    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
    expect(result.errors!.some(e => e.path.includes("citations.0"))).toBe(true)
  })

  test("malformed JSON returns parse error at root", () => {
    const malformed = "[broken"

    const result = validateCitationsJson(malformed)

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0].path).toBe("(root)")
    expect(result.errors![0].message).toContain("Invalid JSON")
  })
})

describe("validateRisksJson", () => {
  test("valid risks.json returns success with data", () => {
    const valid = JSON.stringify({
      risks: [
        {
          description: "Risk description",
          likelihood: "medium",
          impact: "high",
          mitigation: "Do X to mitigate",
        },
      ],
    })

    const result = validateRisksJson(valid)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.risks).toHaveLength(1)
    expect(result.data?.risks[0].likelihood).toBe("medium")
  })

  test("missing required field returns errors with field path", () => {
    const invalid = JSON.stringify({
      risks: [
        {
          description: "Missing likelihood, impact, mitigation",
        },
      ],
    })

    const result = validateRisksJson(invalid)

    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
    expect(result.errors!.some(e => e.path.includes("risks.0"))).toBe(true)
  })

  test("invalid enum value returns errors", () => {
    const invalid = JSON.stringify({
      risks: [
        {
          description: "Invalid enum",
          likelihood: "invalid-value",
          impact: "high",
          mitigation: "Mitigate",
        },
      ],
    })

    const result = validateRisksJson(invalid)

    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.some(e => e.path.includes("risks.0.likelihood"))).toBe(true)
  })

  test("malformed JSON returns parse error at root", () => {
    const malformed = "}"

    const result = validateRisksJson(malformed)

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0].path).toBe("(root)")
    expect(result.errors![0].message).toContain("Invalid JSON")
  })
})
