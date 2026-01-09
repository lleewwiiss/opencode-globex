import * as fs from "node:fs"
import * as path from "node:path"

export interface FileSearchResult {
  path: string
  isDirectory: boolean
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".globex",
  ".opencode",
  "dist",
  "build",
  ".next",
  ".cache",
  "coverage",
])

const IGNORED_EXTENSIONS = new Set([".lock", ".log"])

export function searchFiles(
  query: string,
  workdir: string,
  limit = 20
): FileSearchResult[] {
  const results: FileSearchResult[] = []
  const lowerQuery = query.toLowerCase()

  function walk(dir: string, depth = 0) {
    if (depth > 5 || results.length >= limit) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (results.length >= limit) break

      const name = entry.name
      if (name.startsWith(".") && name !== ".globex") continue
      if (entry.isDirectory() && IGNORED_DIRS.has(name)) continue

      const fullPath = path.join(dir, name)
      const relativePath = path.relative(workdir, fullPath)
      const ext = path.extname(name)

      if (IGNORED_EXTENSIONS.has(ext)) continue

      const lowerName = name.toLowerCase()
      const lowerRelPath = relativePath.toLowerCase()

      if (lowerName.includes(lowerQuery) || lowerRelPath.includes(lowerQuery)) {
        results.push({
          path: relativePath + (entry.isDirectory() ? "/" : ""),
          isDirectory: entry.isDirectory(),
        })
      }

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1)
      }
    }
  }

  walk(workdir)

  return results.sort((a, b) => {
    const aDepth = a.path.split("/").length
    const bDepth = b.path.split("/").length
    if (aDepth !== bDepth) return aDepth - bDepth
    return a.path.localeCompare(b.path)
  })
}

export function parseFileReference(input: string): {
  path: string
  lineStart?: number
  lineEnd?: number
} {
  const hashIndex = input.lastIndexOf("#")
  if (hashIndex === -1) {
    return { path: input }
  }

  const basePath = input.substring(0, hashIndex)
  const linePart = input.substring(hashIndex + 1)
  const lineMatch = linePart.match(/^L?(\d+)(?:-L?(\d+))?$/i)

  if (!lineMatch) {
    return { path: basePath }
  }

  const startLine = Number(lineMatch[1])
  const endLine = lineMatch[2] ? Number(lineMatch[2]) : undefined

  return {
    path: basePath,
    lineStart: startLine,
    lineEnd: endLine && endLine > startLine ? endLine : undefined,
  }
}

export function formatFileReference(
  filePath: string,
  lineStart?: number,
  lineEnd?: number
): string {
  let display = filePath
  if (lineStart !== undefined) {
    display += `#L${lineStart}`
    if (lineEnd !== undefined) {
      display += `-L${lineEnd}`
    }
  }
  return display
}
