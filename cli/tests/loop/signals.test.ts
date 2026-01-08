import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Exit } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import {
  checkSignal,
  createSignal,
  clearSignals,
  watchForSignalEffect,
  SignalTimeoutError,
} from "../../src/loop/signals.js"
import { Effect } from "effect"

describe("cli/loop/signals", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-signals-test-"))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("createSignal / checkSignal", () => {
    test("createSignal creates file, checkSignal returns true", async () => {
      expect(await checkSignal(testDir, "done")).toBe(false)

      await createSignal(testDir, "done")

      expect(await checkSignal(testDir, "done")).toBe(true)
      const filePath = path.join(testDir, ".globex-done")
      const stat = await fs.stat(filePath)
      expect(stat.isFile()).toBe(true)
    })

    test("checkSignal returns false for non-existent signal", async () => {
      expect(await checkSignal(testDir, "approved")).toBe(false)
      expect(await checkSignal(testDir, "rejected")).toBe(false)
      expect(await checkSignal(testDir, "pause")).toBe(false)
    })

    test("creates all signal types", async () => {
      await createSignal(testDir, "done")
      await createSignal(testDir, "approved")
      await createSignal(testDir, "rejected")
      await createSignal(testDir, "pause")

      expect(await checkSignal(testDir, "done")).toBe(true)
      expect(await checkSignal(testDir, "approved")).toBe(true)
      expect(await checkSignal(testDir, "rejected")).toBe(true)
      expect(await checkSignal(testDir, "pause")).toBe(true)
    })
  })

  describe("clearSignals", () => {
    test("removes all created signals", async () => {
      await createSignal(testDir, "done")
      await createSignal(testDir, "approved")
      await createSignal(testDir, "rejected")

      expect(await checkSignal(testDir, "done")).toBe(true)
      expect(await checkSignal(testDir, "approved")).toBe(true)
      expect(await checkSignal(testDir, "rejected")).toBe(true)

      await clearSignals(testDir)

      expect(await checkSignal(testDir, "done")).toBe(false)
      expect(await checkSignal(testDir, "approved")).toBe(false)
      expect(await checkSignal(testDir, "rejected")).toBe(false)
    })

    test("succeeds when no signals exist", async () => {
      await clearSignals(testDir)
      expect(await checkSignal(testDir, "done")).toBe(false)
    })
  })

  describe("watchForSignal", () => {
    test("returns true when signal appears", async () => {
      await createSignal(testDir, "approved")

      const result = await Effect.runPromise(
        watchForSignalEffect(testDir, "approved", 500)
      )

      expect(result).toBe(true)
    })

    test("returns true when signal appears during polling", async () => {
      setTimeout(async () => {
        await createSignal(testDir, "done")
      }, 150)

      const result = await Effect.runPromise(
        watchForSignalEffect(testDir, "done", 1000)
      )

      expect(result).toBe(true)
    })

    test("times out when signal never appears", async () => {
      const result = await Effect.runPromiseExit(
        watchForSignalEffect(testDir, "rejected", 200)
      )

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const cause = result.cause
        expect(cause._tag).toBe("Fail")
      }
    })
  })
})
