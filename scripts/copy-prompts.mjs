import { copyFile, mkdir, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const sourceDir = path.join(projectRoot, "cli", "src", "agents", "prompts")
const targetDir = path.join(
  projectRoot,
  "dist",
  "cli",
  "src",
  "agents",
  "prompts",
)

await mkdir(targetDir, { recursive: true })
const entries = await readdir(sourceDir)

await Promise.all(
  entries
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) =>
      copyFile(path.join(sourceDir, entry), path.join(targetDir, entry)),
    ),
)
