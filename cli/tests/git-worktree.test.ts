import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import {
  createWorktree,
  listWorktrees,
  removeWorktree,
} from "../src/git.js"

describe("cli/git/worktree", () => {
  let testDir: string
  let worktreePath: string

  beforeEach(async () => {
    // Use realpath to resolve symlinks (e.g., /var -> /private/var on macOS)
    // Git worktree list returns resolved paths
    const tmpBase = await fs.realpath(os.tmpdir())
    testDir = await fs.mkdtemp(path.join(tmpBase, "globex-worktree-test-"))
    worktreePath = path.join(testDir, "worktree-test")

    // Initialize a git repo with an initial commit (required for worktrees)
    const { execSync } = await import("node:child_process")
    execSync("git init", { cwd: testDir, stdio: "ignore" })
    execSync("git config user.email 'test@test.com'", { cwd: testDir, stdio: "ignore" })
    execSync("git config user.name 'Test'", { cwd: testDir, stdio: "ignore" })
    await fs.writeFile(path.join(testDir, "README.md"), "# Test")
    execSync("git add .", { cwd: testDir, stdio: "ignore" })
    execSync("git commit -m 'Initial commit'", { cwd: testDir, stdio: "ignore" })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe("createWorktree", () => {
    test("creates directory and branch", async () => {
      const branchName = "feature-test"
      const result = await createWorktree(testDir, worktreePath, branchName)

      expect(result.path).toBe(worktreePath)
      expect(result.branch).toBe(branchName)
      expect(result.commit).toBeTruthy()
      expect(result.isLocked).toBe(false)

      // Verify directory exists
      const stat = await fs.stat(worktreePath)
      expect(stat.isDirectory()).toBe(true)

      // Verify branch exists by checking .git file in worktree
      const gitFile = await fs.readFile(path.join(worktreePath, ".git"), "utf-8")
      expect(gitFile).toContain("gitdir:")
    })
  })

  describe("listWorktrees", () => {
    test("returns created worktree", async () => {
      const branchName = "feature-list-test"
      await createWorktree(testDir, worktreePath, branchName)

      const worktrees = await listWorktrees(testDir)

      // Should have at least 2: main worktree and the new one
      expect(worktrees.length).toBeGreaterThanOrEqual(2)

      const created = worktrees.find((w) => w.path === worktreePath)
      expect(created).toBeDefined()
      expect(created!.branch).toBe(branchName)
      expect(created!.commit).toBeTruthy()
    })

    test("returns main worktree", async () => {
      const worktrees = await listWorktrees(testDir)

      // Should have at least the main worktree
      expect(worktrees.length).toBeGreaterThanOrEqual(1)

      const main = worktrees.find((w) => w.path === testDir)
      expect(main).toBeDefined()
    })
  })

  describe("removeWorktree", () => {
    test("removes directory", async () => {
      const branchName = "feature-remove-test"
      await createWorktree(testDir, worktreePath, branchName)

      // Verify it exists first
      const beforeList = await listWorktrees(testDir)
      expect(beforeList.some((w) => w.path === worktreePath)).toBe(true)

      await removeWorktree(testDir, worktreePath)

      // Directory should be removed
      await expect(fs.stat(worktreePath)).rejects.toThrow()

      // Worktree should not appear in list
      const afterList = await listWorktrees(testDir)
      expect(afterList.some((w) => w.path === worktreePath)).toBe(false)
    })
  })
})
