import { Effect } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Schema } from "effect"
import type { GlobexState, Phase } from "./state/types.js"
import { PHASE_ORDER } from "./state/types.js"

const GLOBEX_DIR = ".globex"
const PROJECTS_DIR = "projects"
const STATE_FILE = "state.json"
const ACTIVE_PROJECT_FILE = "active-project"
const DEFAULT_PROJECT = "default"

export const getGlobexBaseDir = (workdir: string): string =>
  `${workdir}/${GLOBEX_DIR}`

export const getProjectDir = (workdir: string, projectId: string): string =>
  `${getGlobexBaseDir(workdir)}/${PROJECTS_DIR}/${projectId}`

export const getStatePath = (workdir: string, projectId: string): string =>
  `${getProjectDir(workdir, projectId)}/${STATE_FILE}`

export const getActiveProjectPath = (workdir: string): string =>
  `${getGlobexBaseDir(workdir)}/${ACTIVE_PROJECT_FILE}`

export class ProjectNotFoundError extends Schema.TaggedError<ProjectNotFoundError>()(
  "ProjectNotFoundError",
  { projectId: Schema.String, path: Schema.String }
) {}

export class ActiveProjectNotFoundError extends Schema.TaggedError<ActiveProjectNotFoundError>()(
  "ActiveProjectNotFoundError",
  { path: Schema.String }
) {}

export class StateParseError extends Schema.TaggedError<StateParseError>()(
  "StateParseError",
  { message: Schema.String }
) {}

export class StateValidationError extends Schema.TaggedError<StateValidationError>()(
  "StateValidationError",
  { field: Schema.String, message: Schema.String }
) {}

const isValidPhase = (phase: unknown): phase is Phase =>
  typeof phase === "string" && PHASE_ORDER.includes(phase as Phase)

const isValidISODate = (date: unknown): boolean => {
  if (typeof date !== "string") return false
  const parsed = Date.parse(date)
  return !isNaN(parsed)
}

const validateState = (state: unknown): Effect.Effect<GlobexState, StateValidationError> =>
  Effect.gen(function* () {
    if (typeof state !== "object" || state === null) {
      return yield* Effect.fail(new StateValidationError({ 
        field: "root", 
        message: "State must be an object" 
      }))
    }

    const s = state as Record<string, unknown>

    if (typeof s.projectName !== "string" || s.projectName.length === 0) {
      return yield* Effect.fail(new StateValidationError({ 
        field: "projectName", 
        message: "projectName must be a non-empty string" 
      }))
    }

    if (!isValidPhase(s.currentPhase)) {
      return yield* Effect.fail(new StateValidationError({ 
        field: "currentPhase", 
        message: `currentPhase must be one of: ${PHASE_ORDER.join(", ")}` 
      }))
    }

    if (!isValidISODate(s.createdAt)) {
      return yield* Effect.fail(new StateValidationError({ 
        field: "createdAt", 
        message: "createdAt must be a valid ISO date string" 
      }))
    }

    if (!isValidISODate(s.updatedAt)) {
      return yield* Effect.fail(new StateValidationError({ 
        field: "updatedAt", 
        message: "updatedAt must be a valid ISO date string" 
      }))
    }

    if (s.approvals !== undefined && (typeof s.approvals !== "object" || s.approvals === null)) {
      return yield* Effect.fail(new StateValidationError({ 
        field: "approvals", 
        message: "approvals must be an object if present" 
      }))
    }

    if (s.artifacts !== undefined && (typeof s.artifacts !== "object" || s.artifacts === null)) {
      return yield* Effect.fail(new StateValidationError({ 
        field: "artifacts", 
        message: "artifacts must be an object if present" 
      }))
    }

    return state as GlobexState
  })

const readActiveProject = (workdir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = getActiveProjectPath(workdir)
    const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false))
    
    if (!exists) {
      return yield* Effect.fail(new ActiveProjectNotFoundError({ path }))
    }
    
    const content = yield* fs.readFileString(path).pipe(
      Effect.mapError(() => new ActiveProjectNotFoundError({ path }))
    )
    
    const trimmed = content.trim()
    if (trimmed.length === 0) {
      return yield* Effect.fail(new ActiveProjectNotFoundError({ path }))
    }
    
    return trimmed
  })

const resolveProjectId = (workdir: string, projectId?: string) =>
  projectId 
    ? Effect.succeed(projectId) 
    : readActiveProject(workdir).pipe(
        Effect.orElseSucceed(() => DEFAULT_PROJECT)
      )

export const resumeProjectEffect = (workdir: string, projectId?: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pid = yield* resolveProjectId(workdir, projectId)
    const path = getStatePath(workdir, pid)
    
    const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false))
    if (!exists) {
      return yield* Effect.fail(new ProjectNotFoundError({ projectId: pid, path }))
    }
    
    const content = yield* fs.readFileString(path).pipe(
      Effect.mapError(() => new ProjectNotFoundError({ projectId: pid, path }))
    )
    
    const parsed = yield* Effect.try({
      try: () => JSON.parse(content),
      catch: (e) => new StateParseError({ 
        message: e instanceof Error ? e.message : "Unknown parse error" 
      })
    })
    
    const validated = yield* validateState(parsed)
    return validated
  })

export type ResumeError = 
  | ProjectNotFoundError 
  | ActiveProjectNotFoundError 
  | StateParseError 
  | StateValidationError

export const resumeProject = async (
  workdir: string, 
  projectId?: string
): Promise<GlobexState> =>
  Effect.runPromise(
    resumeProjectEffect(workdir, projectId).pipe(
      Effect.provide(NodeFileSystem.layer)
    )
  )
