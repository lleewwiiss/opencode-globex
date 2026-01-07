import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import { setActiveProject, listProjects, stateExistsEffect } from "../state/persistence.js"

export const createSelectProject = (workdir: string): ToolDefinition => tool({
  description: "Switch active Globex project. All subsequent tools operate on the selected project.",
  args: {
    projectId: tool.schema.string(),
  },
  async execute(args) {
    const { projectId } = args

    const effect = Effect.gen(function* () {
      const exists = yield* stateExistsEffect(workdir, projectId)
      if (!exists) {
        const projects = yield* listProjects(workdir)
        return {
          success: false,
          error: `Project '${projectId}' not found`,
          availableProjects: projects.map((p) => p.projectId),
        }
      }

      yield* setActiveProject(workdir, projectId)
      return {
        success: true,
        activeProject: projectId,
      }
    })

    const result = await Effect.runPromise(effect)
    return JSON.stringify(result)
  },
})
