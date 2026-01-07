import { Context, Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import { Schema } from "effect"
import type { GlobexState, Phase, Approval, LoopState } from "./types.js"

const GLOBEX_DIR = ".globex"
const PROJECTS_DIR = "projects"
const STATE_FILE = "state.json"
const LOOP_STATE_FILE = "loop-state.json"
const ACTIVE_PROJECT_FILE = "active-project"
export const DEFAULT_PROJECT = "default"

export const getGlobexBaseDir = (workdir: string): string =>
  `${workdir}/${GLOBEX_DIR}`

export const getProjectDir = (workdir: string, projectId: string): string =>
  `${getGlobexBaseDir(workdir)}/${PROJECTS_DIR}/${projectId}`

export const getActiveProjectPath = (workdir: string): string =>
  `${getGlobexBaseDir(workdir)}/${ACTIVE_PROJECT_FILE}`

export const getLegacyStatePath = (workdir: string): string =>
  `${getGlobexBaseDir(workdir)}/${STATE_FILE}`

export const getGlobexDir = (workdir: string, projectId?: string): string =>
  projectId ? getProjectDir(workdir, projectId) : getGlobexBaseDir(workdir)

export const getStatePath = (workdir: string, projectId?: string): string =>
  `${getProjectDir(workdir, projectId || DEFAULT_PROJECT)}/${STATE_FILE}`

export const getLoopStatePath = (workdir: string, projectId?: string): string =>
  `${getProjectDir(workdir, projectId || DEFAULT_PROJECT)}/${LOOP_STATE_FILE}`

export class StateNotFoundError extends Schema.TaggedError<StateNotFoundError>()(
  "StateNotFoundError",
  { path: Schema.String }
) {}

export class StateParseError extends Schema.TaggedError<StateParseError>()(
  "StateParseError",
  { message: Schema.String }
) {}

export class StateWriteError extends Schema.TaggedError<StateWriteError>()(
  "StateWriteError",
  { path: Schema.String, message: Schema.String }
) {}

export const createInitialState = (projectName: string, description: string): GlobexState => ({
  currentPhase: "init",
  projectName,
  description,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  approvals: {},
  artifacts: {},
  interviewHistory: {}
})

export interface ProjectInfo {
  projectId: string
  projectName: string
  phase: Phase
  updatedAt: string
}

export class GlobexPersistence extends Context.Tag("GlobexPersistence")<GlobexPersistence, {
  readonly readState: (workdir: string, projectId?: string) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError>
  readonly writeState: (workdir: string, state: GlobexState, projectId?: string) => Effect.Effect<void, StateWriteError>
  readonly stateExists: (workdir: string, projectId?: string) => Effect.Effect<boolean>
  readonly updatePhase: (workdir: string, phase: Phase, projectId?: string) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError>
  readonly recordApproval: (workdir: string, phase: "research" | "plan" | "features", approval: Approval, projectId?: string) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError>
  readonly recordArtifact: (workdir: string, name: string, filePath: string, projectId?: string) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError>
  readonly getActiveProject: (workdir: string) => Effect.Effect<string>
  readonly setActiveProject: (workdir: string, projectId: string) => Effect.Effect<void, StateWriteError>
  readonly listProjects: (workdir: string) => Effect.Effect<ProjectInfo[]>
  readonly migrateIfNeeded: (workdir: string) => Effect.Effect<boolean, StateWriteError>
  readonly loadLoopState: (workdir: string, projectId?: string) => Effect.Effect<LoopState | null, StateParseError>
  readonly saveLoopState: (workdir: string, state: LoopState, projectId?: string) => Effect.Effect<void, StateWriteError>
  readonly clearLoopState: (workdir: string, projectId?: string) => Effect.Effect<void, StateWriteError>
}>() {}

export const GlobexPersistenceLive = Layer.effect(
  GlobexPersistence,
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    const getActiveProject = (workdir: string): Effect.Effect<string> =>
      fs.readFileString(getActiveProjectPath(workdir)).pipe(
        Effect.map((s) => s.trim()),
        Effect.orElseSucceed(() => DEFAULT_PROJECT)
      )

    const setActiveProject = (workdir: string, projectId: string): Effect.Effect<void, StateWriteError> => {
      const basePath = getGlobexBaseDir(workdir)
      const activePath = getActiveProjectPath(workdir)
      return Effect.gen(function*() {
        yield* fs.makeDirectory(basePath, { recursive: true }).pipe(
          Effect.mapError((e) => new StateWriteError({ path: basePath, message: e.message }))
        )
        yield* fs.writeFileString(activePath, projectId).pipe(
          Effect.mapError((e) => new StateWriteError({ path: activePath, message: e.message }))
        )
      })
    }

    const resolveProjectId = (workdir: string, projectId?: string): Effect.Effect<string> =>
      projectId ? Effect.succeed(projectId) : getActiveProject(workdir)

    const readState = (workdir: string, projectId?: string): Effect.Effect<GlobexState, StateNotFoundError | StateParseError> =>
      Effect.gen(function*() {
        const pid = yield* resolveProjectId(workdir, projectId)
        const path = getStatePath(workdir, pid)
        const content = yield* fs.readFileString(path).pipe(
          Effect.mapError(() => new StateNotFoundError({ path }))
        )
        return yield* Effect.try({
          try: () => JSON.parse(content) as GlobexState,
          catch: (e) => new StateParseError({ message: e instanceof Error ? e.message : "Unknown parse error" })
        })
      })

    const writeState = (workdir: string, state: GlobexState, projectId?: string): Effect.Effect<void, StateWriteError> =>
      Effect.gen(function*() {
        const pid = yield* resolveProjectId(workdir, projectId)
        const dir = getProjectDir(workdir, pid)
        const path = getStatePath(workdir, pid)
        const updatedState = { ...state, updatedAt: new Date().toISOString() }
        yield* fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.mapError((e) => new StateWriteError({ path: dir, message: e.message }))
        )
        yield* fs.writeFileString(path, JSON.stringify(updatedState, null, 2)).pipe(
          Effect.mapError((e) => new StateWriteError({ path, message: e.message }))
        )
      })

    const stateExists = (workdir: string, projectId?: string): Effect.Effect<boolean> =>
      Effect.gen(function*() {
        const pid = yield* resolveProjectId(workdir, projectId)
        const path = getStatePath(workdir, pid)
        return yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false))
      })

    const updatePhase = (workdir: string, phase: Phase, projectId?: string): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
      Effect.gen(function*() {
        const state = yield* readState(workdir, projectId)
        const updated = { ...state, currentPhase: phase }
        yield* writeState(workdir, updated, projectId)
        return { ...updated, updatedAt: new Date().toISOString() }
      })

    const recordApproval = (workdir: string, phase: "research" | "plan" | "features", approval: Approval, projectId?: string): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
      Effect.gen(function*() {
        const state = yield* readState(workdir, projectId)
        const updated: GlobexState = {
          ...state,
          approvals: { ...state.approvals, [phase]: approval }
        }
        yield* writeState(workdir, updated, projectId)
        return { ...updated, updatedAt: new Date().toISOString() }
      })

    const recordArtifact = (workdir: string, name: string, filePath: string, projectId?: string): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
      Effect.gen(function*() {
        const state = yield* readState(workdir, projectId)
        const updated: GlobexState = {
          ...state,
          artifacts: { ...state.artifacts, [name]: filePath }
        }
        yield* writeState(workdir, updated, projectId)
        return { ...updated, updatedAt: new Date().toISOString() }
      })

    const listProjects = (workdir: string): Effect.Effect<ProjectInfo[]> =>
      Effect.gen(function*() {
        const projectsDir = `${getGlobexBaseDir(workdir)}/${PROJECTS_DIR}`
        const exists = yield* fs.exists(projectsDir).pipe(Effect.orElseSucceed(() => false))
        if (!exists) return []

        const entries = yield* fs.readDirectory(projectsDir).pipe(Effect.orElseSucceed(() => []))
        const projects: ProjectInfo[] = []

        for (const name of entries) {
          const statePath = `${projectsDir}/${name}/${STATE_FILE}`
          const stateFileExists = yield* fs.exists(statePath).pipe(Effect.orElseSucceed(() => false))
          if (stateFileExists) {
            const content = yield* fs.readFileString(statePath).pipe(Effect.orElseSucceed(() => "{}"))
            const state = JSON.parse(content) as Partial<GlobexState>
            projects.push({
              projectId: name,
              projectName: state.projectName || name,
              phase: state.currentPhase || "init",
              updatedAt: state.updatedAt || ""
            })
          }
        }
        return projects
      })

    const migrateIfNeeded = (workdir: string): Effect.Effect<boolean, StateWriteError> =>
      Effect.gen(function*() {
        const legacyPath = getLegacyStatePath(workdir)
        const legacyExists = yield* fs.exists(legacyPath).pipe(Effect.orElseSucceed(() => false))
        if (!legacyExists) return false

        const defaultDir = getProjectDir(workdir, DEFAULT_PROJECT)
        const newPath = getStatePath(workdir, DEFAULT_PROJECT)
        const newExists = yield* fs.exists(newPath).pipe(Effect.orElseSucceed(() => false))
        if (newExists) return false

        yield* fs.makeDirectory(defaultDir, { recursive: true }).pipe(
          Effect.mapError((e) => new StateWriteError({ path: defaultDir, message: e.message }))
        )

        const content = yield* fs.readFileString(legacyPath).pipe(
          Effect.mapError((e) => new StateWriteError({ path: legacyPath, message: e.message }))
        )
        yield* fs.writeFileString(newPath, content).pipe(
          Effect.mapError((e) => new StateWriteError({ path: newPath, message: e.message }))
        )

        const artifactsToMigrate = ["research.md", "research.citations.json", "plan.md", "plan.risks.json", "features.json", "progress.md"]
        const baseDir = getGlobexBaseDir(workdir)
        for (const artifact of artifactsToMigrate) {
          const oldPath = `${baseDir}/${artifact}`
          const artifactExists = yield* fs.exists(oldPath).pipe(Effect.orElseSucceed(() => false))
          if (artifactExists) {
            const artifactContent = yield* fs.readFileString(oldPath).pipe(Effect.orElseSucceed(() => ""))
            yield* fs.writeFileString(`${defaultDir}/${artifact}`, artifactContent).pipe(
              Effect.mapError((e) => new StateWriteError({ path: `${defaultDir}/${artifact}`, message: e.message }))
            )
          }
        }

        yield* setActiveProject(workdir, DEFAULT_PROJECT)
        return true
      })

    const loadLoopState = (workdir: string, projectId?: string): Effect.Effect<LoopState | null, StateParseError> =>
      Effect.gen(function*() {
        const pid = yield* resolveProjectId(workdir, projectId)
        const path = getLoopStatePath(workdir, pid)
        const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false))
        if (!exists) return null
        
        const content = yield* fs.readFileString(path).pipe(Effect.orElseSucceed(() => "{}"))
        return yield* Effect.try({
          try: () => JSON.parse(content) as LoopState,
          catch: (e) => new StateParseError({ message: e instanceof Error ? e.message : "Unknown parse error" })
        })
      })

    const saveLoopState = (workdir: string, state: LoopState, projectId?: string): Effect.Effect<void, StateWriteError> =>
      Effect.gen(function*() {
        const pid = yield* resolveProjectId(workdir, projectId)
        const dir = getProjectDir(workdir, pid)
        const path = getLoopStatePath(workdir, pid)
        yield* fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.mapError((e) => new StateWriteError({ path: dir, message: e.message }))
        )
        yield* fs.writeFileString(path, JSON.stringify(state, null, 2)).pipe(
          Effect.mapError((e) => new StateWriteError({ path, message: e.message }))
        )
      })

    const clearLoopState = (workdir: string, projectId?: string): Effect.Effect<void, StateWriteError> =>
      Effect.gen(function*() {
        const pid = yield* resolveProjectId(workdir, projectId)
        const path = getLoopStatePath(workdir, pid)
        const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false))
        if (exists) {
          yield* fs.remove(path).pipe(
            Effect.mapError((e) => new StateWriteError({ path, message: e.message }))
          )
        }
      })

    return {
      readState,
      writeState,
      stateExists,
      updatePhase,
      recordApproval,
      recordArtifact,
      getActiveProject,
      setActiveProject,
      listProjects,
      migrateIfNeeded,
      loadLoopState,
      saveLoopState,
      clearLoopState
    }
  })
)
