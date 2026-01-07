import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect } from "effect"
import { createInitialState, writeState, stateExists, getGlobexDir } from "../state/persistence.js"

export const createGlobexInit = (workdir: string): ToolDefinition => tool({
  description: "Initialize a new Globex PRD workflow with project name and description",
  args: {
    projectName: tool.schema.string(),
    description: tool.schema.string(),
  },
  async execute(args) {
    const exists = await stateExists(workdir)
    
    if (exists) {
      return JSON.stringify({
        success: false,
        error: "Globex project already exists. Delete .globex/ to reinitialize.",
        globexDir: getGlobexDir(workdir),
      })
    }
    
    const effect = Effect.gen(function* () {
      const state = createInitialState(args.projectName, args.description)
      yield* writeState(workdir, state)
      
      return {
        success: true,
        projectName: args.projectName,
        phase: state.currentPhase,
        globexDir: getGlobexDir(workdir),
        nextStep: "Run /globex-research to explore the codebase",
      }
    })
    
    const result = await Effect.runPromise(effect)
    return JSON.stringify(result)
  },
})
