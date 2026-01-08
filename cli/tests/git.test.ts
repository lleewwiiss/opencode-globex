import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { execSync } from "node:child_process"
import {
  getHeadHash,
  getCommitsSince,
  getDiffStats,
  commitChanges,
} from "../src/git.js"

const exec = (cmd: string, cwd: string) =>
  execSync(cmd, { cwd, encoding: "utf-8", stdio: "pipe" })

describe("cli/git", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-git-test-"))
    exec("git init", testDir)
    exec("git config user.email 'test@test.com'", testDir)
    exec("git config user.name 'Test'", testDir)
    await fs.writeFile(path.join(testDir, "file.txt"), "initial")
    exec("git add -A", testDir)
    exec("git commit -m 'initial commit'", testDir)
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("getHeadHash", () => {
    test("returns 40-char SHA in git repo", async () => {
      const hash = await getHeadHash(testDir)
      expect(hash).toMatch(/^[a-f0-9]{40}$/)
    })
  })

  describe("getCommitsSince", () => {
    test("returns empty array when no new commits", async () => {
      const hash = await getHeadHash(testDir)
      const commits = await getCommitsSince(testDir, hash)
      expect(commits).toEqual([])
    })

    test("returns commits after given hash", async () => {
      const baseHash = await getHeadHash(testDir)
      await fs.writeFile(path.join(testDir, "file2.txt"), "second")
      exec("git add -A", testDir)
      exec("git commit -m 'second commit'", testDir)

      const commits = await getCommitsSince(testDir, baseHash)
      expect(commits.length).toBe(1)
      expect(commits[0].subject).toBe("second commit")
      expect(commits[0].hash).toMatch(/^[a-f0-9]{40}$/)
    })
  })

  describe("getDiffStats", () => {
    test("returns zero stats when no changes", async () => {
      const stats = await getDiffStats(testDir)
      expect(stats.filesChanged).toBe(0)
      expect(stats.files).toEqual([])
    })

    test("returns file change summary", async () => {
      await fs.writeFile(path.join(testDir, "new.txt"), "new content")
      await fs.writeFile(path.join(testDir, "file.txt"), "modified")

      const stats = await getDiffStats(testDir)
      expect(stats.filesChanged).toBe(2)
      expect(stats.files).toContain("new.txt")
      expect(stats.files).toContain("file.txt")
    })
  })

  describe("commitChanges", () => {
    test("stages all and commits", async () => {
      await fs.writeFile(path.join(testDir, "staged.txt"), "staged content")
      const basehash = await getHeadHash(testDir)

      const newHash = await commitChanges(testDir, "test commit")

      expect(newHash).toMatch(/^[a-f0-9]{40}$/)
      expect(newHash).not.toBe(basehash)

      const commits = await getCommitsSince(testDir, basehash)
      expect(commits.length).toBe(1)
      expect(commits[0].subject).toBe("test commit")
    })
  })
})
