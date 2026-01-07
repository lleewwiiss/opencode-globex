import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import {
  createInitialState,
  writeState,
  stateExistsEffect,
  setActiveProject,
  migrateIfNeeded,
  getProjectDir
} from "../state/persistence.js"

const sanitizeProjectId = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 50)

export const createGlobexInit = (workdir: string): ToolDefinition => tool({
  description: "Initialize a new Globex PRD workflow with project name and description",
  args: {
    projectName: tool.schema.string(),
    description: tool.schema.string(),
  },
  async execute(args) {
    const projectId = sanitizeProjectId(args.projectName)

    const effect = Effect.gen(function* () {
      yield* migrateIfNeeded(workdir)

      const exists = yield* stateExistsEffect(workdir, projectId)
      if (exists) {
        return {
          success: false,
          error: `Project '${projectId}' already exists`,
          projectDir: getProjectDir(workdir, projectId),
        }
      }

      const state = createInitialState(args.projectName, args.description)
      yield* writeState(workdir, state, projectId)
      yield* setActiveProject(workdir, projectId)

      return {
        success: true,
        projectId,
        projectName: args.projectName,
        phase: state.currentPhase,
        projectDir: getProjectDir(workdir, projectId),
        nextStep: "Run /globex-research to explore the codebase",
      }
    })

    const result = await Effect.runPromise(effect)
    return JSON.stringify(result)
  },
})
