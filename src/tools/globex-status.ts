import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import { readState, stateExists } from "../state/persistence.js"

export const createGlobexStatus = (workdir: string): ToolDefinition => tool({
  description: "Get current globex project status including phase, approvals, and artifacts",
  args: {},
  async execute() {
    const exists = await stateExists(workdir)
    if (!exists) {
      return "No globex project found. Run /globex-init to start."
    }
    
    const effect = Effect.gen(function* () {
      const state = yield* readState(workdir)
      
      const approvalLines = Object.entries(state.approvals)
        .map(([phase, approval]) => `  ${phase}: ${approval?.status}`)
        .join("\n")
      
      const artifactLines = Object.entries(state.artifacts)
        .map(([name, filePath]) => `  ${name}: ${filePath}`)
        .join("\n")
      
      return `Project: ${state.projectName}
Phase: ${state.currentPhase}
Created: ${state.createdAt}
Updated: ${state.updatedAt}

Approvals:
${approvalLines || "  (none)"}

Artifacts:
${artifactLines || "  (none)"}`
    })
    
    return await Effect.runPromise(effect)
  },
})
