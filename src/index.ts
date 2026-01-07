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
import { createAddLearning } from "./tools/add-learning.js"
import { createSetPhase } from "./tools/set-phase.js"
import { stateExists, loadState, getGlobexDir } from "./state/persistence.js"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const RESEARCH_PROMPT = `Conduct deep codebase research for PRD generation.

## Your Mission
Document the codebase AS-IS. Do not suggest improvements or identify problems.
Create a technical map: what exists, where, and how components interact.

## Process
1. Use globex_status() to verify phase is init or research
2. Spawn parallel explore agents to investigate:
   - Entry points, frameworks, project structure
   - Database, API endpoints, data models
   - Design patterns, state management, error handling
   - Test files and testing patterns
3. Synthesize findings into research.md with citations
4. Save via globex_save_artifact()

## Output Format
Create research.md with: Executive Summary, Architecture, Data Flow, Patterns, Integration Points, Risks, Questions.
Create research.citations.json with file:line evidence for each claim.

When complete, inform user to run /globex-interview to validate.`

const INTERVIEW_PROMPT = `Validate phase artifacts through adversarial questioning.

## Your Mission
Challenge BOTH agent claims AND human assumptions. Require file:line evidence.

## Process
1. Use globex_status() to determine current phase
2. Load the corresponding artifact (.globex/research.md, plan.md, or features.json)
3. Generate SPECIFIC questions referencing actual findings
4. For each claim without evidence: demand file:line citation
5. Use globex_verify_citation() to validate references
6. Track progress with globex_check_convergence()
7. When converged, use globex_approve_phase() with: approved | approved_with_risks | rejected

## Question Lenses
- Data consistency: What happens on partial failure?
- Coupling: What's the blast radius of a change?
- Testability: How would you test this before implementing?
- Failure modes: What's the fallback if X fails?

## Convergence
Stop when: no new questions, OR max questions reached, OR user indicates ready.`

const PLAN_PROMPT = `Create detailed implementation plan from approved research.

## Your Mission
Break work into phases with automated AND manual success criteria.
No open questions in the final plan.

## Process
1. Use globex_status() to verify phase is plan
2. Read .globex/research.md completely
3. Draft phase structure and confirm with user
4. Write detailed plan.md with success criteria
5. Create plan.risks.json
6. Save via globex_save_artifact()

## Plan Structure
Each phase needs:
- Overview of what it accomplishes
- Specific file changes with code snippets
- Automated verification (build, test, lint, curl checks)
- Manual verification (UI checks, edge cases)
- PAUSE point for human verification before next phase

When complete, inform user to run /globex-interview to validate.`

const FEATURES_PROMPT = `Generate atomic feature list from approved plan.

## Your Mission
Create features sized for ~50% of agent context window.
Each feature must be completable in a single stateless iteration.

## Size Constraints
- Time: 30-60 minutes
- Files: 10-20 max
- Lines: ~500 max
- Dependencies: 0-2 other features

## Process
1. Use globex_status() to verify phase is features
2. Read .globex/plan.md completely
3. Break each phase into atomic features
4. Split oversized features into setup/core/polish
5. Validate: no circular deps, testable criteria, proper priority
6. Save features.json via globex_save_artifact()

## Feature Schema
Each feature: id, description, category, acceptanceCriteria, verification, passes: false, priority, dependencies, filesTouched, estimatedMinutes.

When complete, inform user to run /globex-interview to validate.`

const RUN_PROMPT = `Execute ONE autonomous Ralph loop iteration.

## Your Mission
Pick ONE feature, implement, verify, commit. No human intervention during loop.

## Process
1. Use globex_get_next_feature() - if done=true, output <promise>ALL_FEATURES_COMPLETE</promise>
2. Read .globex/progress.md for learnings from previous iterations
3. Implement the feature following existing codebase patterns
4. Verify via automated checks (build, test, lint)
5. If verify fails: fix and retry (max 3 attempts), then mark blocked
6. Commit: git add . && git commit -m "feat(globex): [id] - [description]"
7. Mark complete: globex_update_feature(featureId, passes: true)
8. Update progress: globex_update_progress(incrementIteration: true)
9. If critical operational knowledge learned: globex_add_learning("...")

## When to Add Learnings
Learnings persist in AGENTS.md for ALL future sessions. Use sparingly for critical operational knowledge.

**Good examples:**
- Build requires \`pnpm build\` not \`npm run build\`
- Tests need \`DATABASE_URL\` env var or silently skip
- \`/api/v2\` routes require auth header even in dev
- Package X has breaking change in v3; pin to v2.x

**Bad examples:**
- "Fixed the bug" (too vague, not reusable)
- "Remember to run tests" (obvious)
- "Feature F007 complete" (not operational knowledge)
- "User prefers tabs" (preference, not technical fact)

## Rules
- Do ONE feature only. No scope creep.
- NEVER git push. Only commit.
- Exit cleanly for fresh context on next iteration.`

export const GlobexPlugin: Plugin = async (ctx) => {
  const workdir = ctx.directory

  const showToast = async (
    message: string,
    variant: "info" | "success" | "warning" | "error" = "info",
    title?: string
  ) => {
    try {
      await ctx.client.tui.publish({
        body: {
          type: "tui.toast.show",
          properties: { message, variant, title, duration: 5000 },
        },
      })
    } catch {
      await ctx.client.app.log({
        body: { service: "globex", level: "debug", message: `Toast: ${message}` },
      })
    }
  }

  const logError = async (error: string) => {
    try {
      const progressPath = path.join(getGlobexDir(workdir), "progress.md")
      const timestamp = new Date().toISOString()
      const entry = `\n## Error [${timestamp}]\n${error}\n`
      await fs.appendFile(progressPath, entry)
    } catch {
      await ctx.client.app.log({
        body: { service: "globex", level: "error", message: error },
      })
    }
  }

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
      globex_add_learning: createAddLearning(workdir),
      globex_set_phase: createSetPhase(workdir),
    },

    config: async (config) => {
      config.command = {
        ...config.command,
        "globex-init": {
          template: "Initialize a Globex PRD workflow. Project: $ARGUMENTS",
          description: "Start a new Globex workflow for PRD generation",
        },
        "globex-status": {
          template: "Show current Globex project status using globex_status()",
          description: "Check current workflow phase and progress",
        },
        "globex-research": {
          template: RESEARCH_PROMPT,
          description: "Explore codebase and document architecture",
          agent: "globex-research",
          subtask: true,
        },
        "globex-interview": {
          template: INTERVIEW_PROMPT,
          description: "Validate current phase artifact through questioning",
          agent: "globex-interview",
          subtask: true,
        },
        "globex-plan": {
          template: PLAN_PROMPT,
          description: "Create implementation plan from approved research",
          agent: "globex-plan",
          subtask: true,
        },
        "globex-features": {
          template: FEATURES_PROMPT,
          description: "Generate atomic feature list from approved plan",
          agent: "globex-features",
          subtask: true,
        },
        "globex-run": {
          template: RUN_PROMPT,
          description: "Execute one Ralph loop iteration (autonomous)",
          agent: "globex-run",
          subtask: true,
        },
        "globex-help": {
          template: `Explain the Globex workflow:

1. /globex-init [description] - Initialize workflow
2. /globex-research - Explore codebase (subagent)
3. /globex-interview - Validate research (subagent)
4. /globex-plan - Create implementation plan (subagent)
5. /globex-interview - Validate plan (subagent)
6. /globex-features - Generate feature list (subagent)
7. /globex-interview - Validate features (subagent)
8. /globex-run - Execute Ralph loop (run via ./scripts/ralph-loop.sh)

Use /globex-status anytime to check progress.`,
          description: "Show Globex workflow help",
        },
      }

      config.agent = {
        ...config.agent,
        "globex-research": {
          description:
            "Read-only codebase exploration for PRD research. Documents architecture, patterns, and data flow without suggesting changes.",
          mode: "subagent",
          tools: {
            write: false,
            edit: false,
          },
          permission: {
            bash: "ask",
          },
        },
        "globex-interview": {
          description:
            "Adversarial validation of phase artifacts. Challenges claims, demands file:line evidence, tracks convergence.",
          mode: "subagent",
          tools: {
            write: false,
            edit: false,
            bash: false,
          },
        },
        "globex-plan": {
          description:
            "Creates detailed implementation plans with phased approach, success criteria, and risk assessment.",
          mode: "subagent",
          tools: {
            write: false,
            edit: false,
            bash: false,
          },
        },
        "globex-features": {
          description:
            "Generates context-aware atomic features sized for stateless Ralph loop execution.",
          mode: "subagent",
          tools: {
            write: false,
            edit: false,
            bash: false,
          },
        },
        "globex-run": {
          description:
            "Autonomous Ralph loop executor. Implements ONE feature per iteration, verifies, commits.",
          mode: "subagent",
          permission: {
            edit: "allow",
            bash: "allow",
          },
        },
      }
    },

    event: async ({ event }) => {
      if (event.type === "session.created") {
        const exists = await stateExists(workdir)
        if (exists) {
          try {
            const state = await loadState(workdir)
            await showToast(
              `Resuming: ${state.projectName} (${state.currentPhase})`,
              "info",
              "Globex Project Found"
            )
            await ctx.client.app.log({
              body: {
                service: "globex",
                level: "info",
                message: `Resumed globex project: ${state.projectName}, phase: ${state.currentPhase}`,
              },
            })
          } catch {
            await ctx.client.app.log({
              body: {
                service: "globex",
                level: "warn",
                message: "Found .globex/ but failed to load state",
              },
            })
          }
        }
      }

      if (event.type === "session.error") {
        const errorMessage =
          "properties" in event && event.properties && typeof event.properties === "object"
            ? JSON.stringify(event.properties)
            : "Unknown session error"
        await logError(errorMessage)
        await showToast("Session error logged to progress.md", "error", "Globex Error")
      }

      if (event.type === "session.idle") {
        await ctx.client.app.log({
          body: {
            service: "globex",
            level: "debug",
            message: "Session idle, ready for next command",
          },
        })
      }
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool === "globex_approve_phase") {
        const result = output.output
        if (result.includes("approved")) {
          const match = result.match(/Phase (\w+) (approved|approved_with_risks|rejected)/)
          if (match) {
            const [, phase, status] = match
            const nextPhase =
              phase === "research"
                ? "plan"
                : phase === "plan"
                  ? "features"
                  : phase === "features"
                    ? "execute"
                    : null
            if (status === "approved" || status === "approved_with_risks") {
              await showToast(
                `${phase} approved → ready for ${nextPhase || "next step"}`,
                "success",
                "Phase Approved"
              )
            } else if (status === "rejected") {
              await showToast(`${phase} rejected → redo required`, "warning", "Phase Rejected")
            }
          }
        }
      }

      if (input.tool === "globex_update_feature") {
        const result = output.output
        if (result.includes('"success":true') || result.includes('"passes":true')) {
          await showToast("Feature completed", "success", "Feature Done")
        }
      }
    },
  }
}
