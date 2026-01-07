import { execSync } from "node:child_process"

export function getHeadCommitHash(workdir: string): string | null {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: workdir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim()
  } catch {
    return null
  }
}

export function hasNewCommit(workdir: string, previousHash: string | null): boolean {
  const currentHash = getHeadCommitHash(workdir)
  return currentHash !== null && currentHash !== previousHash
}

export function isWorkingTreeClean(workdir: string): boolean {
  try {
    const result = execSync("git status --porcelain", {
      cwd: workdir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim()
    return result === ""
  } catch {
    return false
  }
}

export function commitChanges(workdir: string, message: string): string | null {
  try {
    execSync("git add -A", {
      cwd: workdir,
      stdio: ["ignore", "ignore", "pipe"]
    })
    
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: workdir,
      stdio: ["ignore", "ignore", "pipe"]
    })
    
    return getHeadCommitHash(workdir)
  } catch {
    return null
  }
}

export function discardChanges(workdir: string): void {
  try {
    execSync("git checkout -- .", {
      cwd: workdir,
      stdio: ["ignore", "ignore", "pipe"]
    })
    
    execSync("git clean -fd", {
      cwd: workdir,
      stdio: ["ignore", "ignore", "pipe"]
    })
  } catch {
    // Ignore errors
  }
}