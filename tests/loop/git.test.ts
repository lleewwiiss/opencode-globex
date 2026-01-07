import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { execSync } from "node:child_process"
import {
  getHeadCommitHash,
  hasNewCommit,
  isWorkingTreeClean,
  commitChanges,
  discardChanges,
} from "../../src/loop/git.js"

describe("git", () => {
  let testDir: string
  let gitRepo: string
  let nonGitDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-git-test-"))
    
    // Create git repo
    gitRepo = path.join(testDir, "repo")
    await fs.mkdir(gitRepo)
    execSync("git init", { cwd: gitRepo, stdio: "ignore" })
    execSync("git config user.name Test", { cwd: gitRepo, stdio: "ignore" })
    execSync("git config user.email test@example.com", { cwd: gitRepo, stdio: "ignore" })
    
    // Initial commit
    await fs.writeFile(path.join(gitRepo, "README.md"), "# Test")
    execSync("git add README.md", { cwd: gitRepo, stdio: "ignore" })
    execSync('git commit -m "Initial commit"', { cwd: gitRepo, stdio: "ignore" })
    
    // Create non-git directory
    nonGitDir = path.join(testDir, "nongit")
    await fs.mkdir(nonGitDir)
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("getHeadCommitHash", () => {
    test("returns commit hash in git repo", () => {
      const hash = getHeadCommitHash(gitRepo)
      expect(hash).toBeTruthy()
      expect(typeof hash).toBe("string")
      expect(hash!.length).toBe(40) // SHA-1 hash length
      expect(/^[a-f0-9]{40}$/.test(hash!)).toBe(true)
    })

    test("returns null outside git repo", () => {
      const hash = getHeadCommitHash(nonGitDir)
      expect(hash).toBeNull()
    })

    test("returns null for non-existent directory", () => {
      const hash = getHeadCommitHash("/non/existent/path")
      expect(hash).toBeNull()
    })
  })

  describe("hasNewCommit", () => {
    test("detects new commit", async () => {
      const initialHash = getHeadCommitHash(gitRepo)
      
      // Create new commit
      await fs.writeFile(path.join(gitRepo, "test.txt"), "test content")
      execSync("git add test.txt", { cwd: gitRepo, stdio: "ignore" })
      execSync('git commit -m "Add test file"', { cwd: gitRepo, stdio: "ignore" })
      
      const hasNew = hasNewCommit(gitRepo, initialHash)
      expect(hasNew).toBe(true)
    })

    test("returns false when no new commit", () => {
      const currentHash = getHeadCommitHash(gitRepo)
      const hasNew = hasNewCommit(gitRepo, currentHash)
      expect(hasNew).toBe(false)
    })

    test("returns true when previous hash is null", () => {
      const hasNew = hasNewCommit(gitRepo, null)
      expect(hasNew).toBe(true)
    })

    test("returns false for non-git directory", () => {
      const hasNew = hasNewCommit(nonGitDir, null)
      expect(hasNew).toBe(false)
    })
  })

  describe("isWorkingTreeClean", () => {
    test("returns true for clean working tree", () => {
      const clean = isWorkingTreeClean(gitRepo)
      expect(clean).toBe(true)
    })

    test("returns false when files are modified", async () => {
      await fs.writeFile(path.join(gitRepo, "README.md"), "# Modified")
      const clean = isWorkingTreeClean(gitRepo)
      expect(clean).toBe(false)
    })

    test("returns false when new files exist", async () => {
      await fs.writeFile(path.join(gitRepo, "new-file.txt"), "new content")
      const clean = isWorkingTreeClean(gitRepo)
      expect(clean).toBe(false)
    })

    test("returns false for non-git directory", () => {
      const clean = isWorkingTreeClean(nonGitDir)
      expect(clean).toBe(false)
    })
  })

  describe("commitChanges", () => {
    test("creates commit and returns hash", async () => {
      await fs.writeFile(path.join(gitRepo, "feature.js"), "console.log('hello')")
      
      const commitHash = commitChanges(gitRepo, "Add feature")
      
      expect(commitHash).toBeTruthy()
      expect(typeof commitHash).toBe("string")
      expect(commitHash!.length).toBe(40)
      
      // Verify commit was created
      expect(isWorkingTreeClean(gitRepo)).toBe(true)
    })

    test("escapes quotes in commit message", async () => {
      await fs.writeFile(path.join(gitRepo, "quotes.txt"), "test")
      
      const commitHash = commitChanges(gitRepo, 'Add "quoted" message')
      
      expect(commitHash).toBeTruthy()
      
      // Verify commit message was properly escaped
      const message = execSync("git log -1 --pretty=format:%s", {
        cwd: gitRepo,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      })
      expect(message).toBe('Add "quoted" message')
    })

    test("returns null when no changes to commit", () => {
      const commitHash = commitChanges(gitRepo, "Nothing to commit")
      expect(commitHash).toBeNull()
    })

    test("returns null for non-git directory", async () => {
      await fs.writeFile(path.join(nonGitDir, "file.txt"), "content")
      const commitHash = commitChanges(nonGitDir, "Test commit")
      expect(commitHash).toBeNull()
    })
  })

  describe("discardChanges", () => {
    test("reverts modified files", async () => {
      const originalContent = await fs.readFile(path.join(gitRepo, "README.md"), "utf8")
      await fs.writeFile(path.join(gitRepo, "README.md"), "# Modified content")
      
      discardChanges(gitRepo)
      
      const restoredContent = await fs.readFile(path.join(gitRepo, "README.md"), "utf8")
      expect(restoredContent).toBe(originalContent)
    })

    test("removes untracked files", async () => {
      const untrackedFile = path.join(gitRepo, "untracked.txt")
      await fs.writeFile(untrackedFile, "untracked content")
      
      expect(await fs.access(untrackedFile).then(() => true).catch(() => false)).toBe(true)
      
      discardChanges(gitRepo)
      
      expect(await fs.access(untrackedFile).then(() => true).catch(() => false)).toBe(false)
    })

    test("removes untracked directories", async () => {
      const untrackedDir = path.join(gitRepo, "untracked-dir")
      await fs.mkdir(untrackedDir)
      await fs.writeFile(path.join(untrackedDir, "file.txt"), "content")
      
      expect(await fs.access(untrackedDir).then(() => true).catch(() => false)).toBe(true)
      
      discardChanges(gitRepo)
      
      expect(await fs.access(untrackedDir).then(() => true).catch(() => false)).toBe(false)
    })

    test("handles non-git directory gracefully", () => {
      // Should not throw error
      expect(() => discardChanges(nonGitDir)).not.toThrow()
    })

    test("ensures working tree is clean after discard", async () => {
      // Create various types of changes
      await fs.writeFile(path.join(gitRepo, "README.md"), "# Modified")
      await fs.writeFile(path.join(gitRepo, "new.txt"), "new file")
      await fs.mkdir(path.join(gitRepo, "new-dir"))
      await fs.writeFile(path.join(gitRepo, "new-dir", "file.txt"), "content")
      
      expect(isWorkingTreeClean(gitRepo)).toBe(false)
      
      discardChanges(gitRepo)
      
      expect(isWorkingTreeClean(gitRepo)).toBe(true)
    })
  })
})