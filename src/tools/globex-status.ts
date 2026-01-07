import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import {
  readState,
  listProjects,
  getActiveProject,
  migrateIfNeeded
} from "../state/persistence.js"

export const createGlobexStatus = (workdir: string): ToolDefinition => tool({
  description: "Get current globex project status including phase, approvals, and artifacts",
  args: {},
  async execute() {
    const effect = Effect.gen(function* () {
      yield* migrateIfNeeded(workdir)

      const projects = yield* listProjects(workdir)
      if (projects.length === 0) {
        return "No globex project found. Run /globex-init to start."
      }

      const activeProjectId = yield* getActiveProject(workdir)
      const state = yield* readState(workdir, activeProjectId)

      const approvalLines = Object.entries(state.approvals)
        .map(([phase, approval]) => `  ${phase}: ${approval?.status}`)
        .join("\n")

      const artifactLines = Object.entries(state.artifacts)
        .map(([name, filePath]) => `  ${name}: ${filePath}`)
        .join("\n")

      let output = `Project: ${state.projectName}
Phase: ${state.currentPhase}
Created: ${state.createdAt}
Updated: ${state.updatedAt}

Approvals:
${approvalLines || "  (none)"}

Artifacts:
${artifactLines || "  (none)"}`

      if (projects.length > 1) {
        const projectList = projects
          .map((p) => `  ${p.projectId === activeProjectId ? "* " : "  "}${p.projectId} (${p.phase})`)
          .join("\n")
        output += `\n\nAll Projects (* = active):\n${projectList}`
      }

      return output
    })

    return await Effect.runPromise(effect)
  },
})
