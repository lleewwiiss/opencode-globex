import type { Plugin } from "@opencode-ai/plugin"
import { createSaveArtifact } from "./tools/save-artifact.js"
import { createApprovePhase } from "./tools/approve-phase.js"
import { createGlobexStatus } from "./tools/globex-status.js"
import { createVerifyCitation } from "./tools/verify-citation.js"
import { createCheckConvergence } from "./tools/check-convergence.js"
import { createGlobexInit } from "./tools/globex-init.js"
import { createUpdateFeature } from "./tools/update-feature.js"
import { createGetNextFeature } from "./tools/get-next-feature.js"
import { createUpdateProgress } from "./tools/update-progress.js"

export const GlobexPlugin: Plugin = async (ctx) => {
  const workdir = ctx.directory
  
  return {
    tool: {
      globex_init: createGlobexInit(workdir),
      globex_status: createGlobexStatus(workdir),
      globex_save_artifact: createSaveArtifact(workdir),
      globex_approve_phase: createApprovePhase(workdir),
      globex_verify_citation: createVerifyCitation(workdir),
      globex_check_convergence: createCheckConvergence(workdir),
      globex_update_feature: createUpdateFeature(workdir),
      globex_get_next_feature: createGetNextFeature(workdir),
      globex_update_progress: createUpdateProgress(workdir),
    },
    
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await ctx.client.app.log({
          body: {
            service: "globex",
            level: "debug",
            message: "session idle, ready for next command",
          }
        })
      }
    },
  }
}
