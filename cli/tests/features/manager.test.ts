import { describe, test, expect } from "bun:test"
import {
  getNextFeature,
  updateFeature,
  getProgressStats,
} from "../../src/features/manager.js"
import type { Feature } from "../../src/state/schema.js"

const makeFeature = (overrides: Partial<Feature> & { id: string }): Feature => ({
  description: `Feature ${overrides.id}`,
  passes: false,
  priority: 1,
  dependencies: [],
  ...overrides,
})

describe("getNextFeature", () => {
  test("returns null when all features passed", () => {
    const features = [
      makeFeature({ id: "a", passes: true }),
      makeFeature({ id: "b", passes: true }),
    ]

    const result = getNextFeature(features)

    expect(result).toBeNull()
  })

  test("skips blocked features", () => {
    const features = [
      makeFeature({ id: "blocked", priority: 1, blocked: true } as Feature & { blocked: boolean }),
      makeFeature({ id: "available", priority: 2 }),
    ]

    const result = getNextFeature(features)

    expect(result?.id).toBe("available")
  })

  test("skips features with unsatisfied dependencies", () => {
    const features = [
      makeFeature({ id: "depends-on-a", priority: 1, dependencies: ["a"] }),
      makeFeature({ id: "no-deps", priority: 2 }),
    ]

    const result = getNextFeature(features)

    expect(result?.id).toBe("no-deps")
  })

  test("returns feature when dependency is satisfied", () => {
    const features = [
      makeFeature({ id: "a", passes: true }),
      makeFeature({ id: "depends-on-a", priority: 1, dependencies: ["a"] }),
    ]

    const result = getNextFeature(features)

    expect(result?.id).toBe("depends-on-a")
  })

  test("returns lowest priority eligible feature", () => {
    const features = [
      makeFeature({ id: "high-priority", priority: 10 }),
      makeFeature({ id: "low-priority", priority: 1 }),
      makeFeature({ id: "mid-priority", priority: 5 }),
    ]

    const result = getNextFeature(features)

    expect(result?.id).toBe("low-priority")
  })

  test("returns null for empty array", () => {
    const result = getNextFeature([])

    expect(result).toBeNull()
  })
})

describe("updateFeature", () => {
  test("modifies passes field", () => {
    const features = [makeFeature({ id: "a" })]

    const result = updateFeature(features, "a", { passes: true })

    expect(result[0].passes).toBe(true)
  })

  test("modifies blocked field", () => {
    const features = [makeFeature({ id: "a" })]

    const result = updateFeature(features, "a", { blocked: true })

    expect((result[0] as Feature & { blocked?: boolean }).blocked).toBe(true)
  })

  test("modifies blockedReason field", () => {
    const features = [makeFeature({ id: "a" })]

    const result = updateFeature(features, "a", { blockedReason: "missing API" })

    expect((result[0] as Feature & { blockedReason?: string }).blockedReason).toBe("missing API")
  })

  test("modifies notes field", () => {
    const features = [makeFeature({ id: "a" })]

    const result = updateFeature(features, "a", { notes: "needs review" })

    expect((result[0] as Feature & { notes?: string }).notes).toBe("needs review")
  })

  test("does not modify other fields", () => {
    const features = [makeFeature({ id: "a", priority: 5, description: "original" })]

    const result = updateFeature(features, "a", { passes: true })

    expect(result[0].priority).toBe(5)
    expect(result[0].description).toBe("original")
  })

  test("only updates matching feature", () => {
    const features = [
      makeFeature({ id: "a" }),
      makeFeature({ id: "b" }),
    ]

    const result = updateFeature(features, "a", { passes: true })

    expect(result[0].passes).toBe(true)
    expect(result[1].passes).toBe(false)
  })

  test("returns unchanged array if id not found", () => {
    const features = [makeFeature({ id: "a" })]

    const result = updateFeature(features, "nonexistent", { passes: true })

    expect(result[0].passes).toBe(false)
  })
})

describe("getProgressStats", () => {
  test("returns correct counts for mixed features", () => {
    const features = [
      makeFeature({ id: "a", passes: true }),
      makeFeature({ id: "b", passes: true }),
      makeFeature({ id: "c", passes: false }),
    ]

    const result = getProgressStats(features)

    expect(result).toEqual({
      completed: 2,
      remaining: 1,
      total: 3,
    })
  })

  test("returns zeros for empty array", () => {
    const result = getProgressStats([])

    expect(result).toEqual({
      completed: 0,
      remaining: 0,
      total: 0,
    })
  })

  test("returns all completed when all passed", () => {
    const features = [
      makeFeature({ id: "a", passes: true }),
      makeFeature({ id: "b", passes: true }),
    ]

    const result = getProgressStats(features)

    expect(result).toEqual({
      completed: 2,
      remaining: 0,
      total: 2,
    })
  })

  test("returns none completed when none passed", () => {
    const features = [
      makeFeature({ id: "a", passes: false }),
      makeFeature({ id: "b", passes: false }),
    ]

    const result = getProgressStats(features)

    expect(result).toEqual({
      completed: 0,
      remaining: 2,
      total: 2,
    })
  })
})
