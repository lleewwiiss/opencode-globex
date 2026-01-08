import { Effect, Layer, Context } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Schema } from "effect"
import type { GlobexState, Phase, Approval } from "./types.js"

const GLOBEX_DIR = ".globex"
const PROJECTS_DIR = "projects"
const STATE_FILE = "state.json"

export const getProjectDir = (workdir: string, projectId: string): string =>
  `${workdir}/${GLOBEX_DIR}/${PROJECTS_DIR}/${projectId}`

export const getStatePath = (workdir: string, projectId: string): string =>
  `${getProjectDir(workdir, projectId)}/${STATE_FILE}`

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

export class CliPersistence extends Context.Tag("CliPersistence")<CliPersistence, {
  readonly readState: (workdir: string, projectId: string) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError>
  readonly writeState: (workdir: string, projectId: string, state: GlobexState) => Effect.Effect<void, StateWriteError>
  readonly stateExists: (workdir: string, projectId: string) => Effect.Effect<boolean>
  readonly updatePhase: (workdir: string, projectId: string, phase: Phase) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError>
  readonly recordApproval: (workdir: string, projectId: string, phase: "plan" | "features", approval: Approval) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError>
}>() {}

export const CliPersistenceLive = Layer.effect(
  CliPersistence,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const readState = (workdir: string, projectId: string): Effect.Effect<GlobexState, StateNotFoundError | StateParseError> =>
      Effect.gen(function* () {
        const path = getStatePath(workdir, projectId)
        const content = yield* fs.readFileString(path).pipe(
          Effect.mapError(() => new StateNotFoundError({ path }))
        )
        return yield* Effect.try({
          try: () => JSON.parse(content) as GlobexState,
          catch: (e) => new StateParseError({ message: e instanceof Error ? e.message : "Unknown parse error" })
        })
      })

    const writeState = (workdir: string, projectId: string, state: GlobexState): Effect.Effect<void, StateWriteError> =>
      Effect.gen(function* () {
        const dir = getProjectDir(workdir, projectId)
        const path = getStatePath(workdir, projectId)
        const updatedState = { ...state, updatedAt: new Date().toISOString() }
        yield* fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.mapError((e) => new StateWriteError({ path: dir, message: e.message }))
        )
        yield* fs.writeFileString(path, JSON.stringify(updatedState, null, 2)).pipe(
          Effect.mapError((e) => new StateWriteError({ path, message: e.message }))
        )
      })

    const stateExists = (workdir: string, projectId: string): Effect.Effect<boolean> =>
      fs.exists(getStatePath(workdir, projectId)).pipe(Effect.orElseSucceed(() => false))

    const updatePhase = (workdir: string, projectId: string, phase: Phase): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
      Effect.gen(function* () {
        const state = yield* readState(workdir, projectId)
        const updated = { ...state, currentPhase: phase }
        yield* writeState(workdir, projectId, updated)
        return { ...updated, updatedAt: new Date().toISOString() }
      })

    const recordApproval = (workdir: string, projectId: string, phase: "plan" | "features", approval: Approval): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
      Effect.gen(function* () {
        const state = yield* readState(workdir, projectId)
        const updated: GlobexState = {
          ...state,
          approvals: { ...state.approvals, [phase]: approval }
        }
        yield* writeState(workdir, projectId, updated)
        return { ...updated, updatedAt: new Date().toISOString() }
      })

    return {
      readState,
      writeState,
      stateExists,
      updatePhase,
      recordApproval
    }
  })
)

const PersistenceLayer = CliPersistenceLive.pipe(
  Layer.provide(NodeFileSystem.layer)
)

export const readState = (workdir: string, projectId: string) =>
  Effect.gen(function* () {
    const persistence = yield* CliPersistence
    return yield* persistence.readState(workdir, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const writeState = (workdir: string, projectId: string, state: GlobexState) =>
  Effect.gen(function* () {
    const persistence = yield* CliPersistence
    return yield* persistence.writeState(workdir, projectId, state)
  }).pipe(Effect.provide(PersistenceLayer))

export const stateExists = (workdir: string, projectId: string) =>
  Effect.gen(function* () {
    const persistence = yield* CliPersistence
    return yield* persistence.stateExists(workdir, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const updatePhase = (workdir: string, projectId: string, phase: Phase) =>
  Effect.gen(function* () {
    const persistence = yield* CliPersistence
    return yield* persistence.updatePhase(workdir, projectId, phase)
  }).pipe(Effect.provide(PersistenceLayer))

export const recordApproval = (workdir: string, projectId: string, phase: "plan" | "features", approval: Approval) =>
  Effect.gen(function* () {
    const persistence = yield* CliPersistence
    return yield* persistence.recordApproval(workdir, projectId, phase, approval)
  }).pipe(Effect.provide(PersistenceLayer))

export const loadState = async (workdir: string, projectId: string): Promise<GlobexState> =>
  Effect.runPromise(readState(workdir, projectId))

export const saveState = async (workdir: string, projectId: string, state: GlobexState): Promise<void> =>
  Effect.runPromise(writeState(workdir, projectId, state))

export const checkStateExists = async (workdir: string, projectId: string): Promise<boolean> =>
  Effect.runPromise(stateExists(workdir, projectId))

export const createState = (projectName: string, description: string, phase: Phase = "init"): GlobexState => ({
  currentPhase: phase,
  projectName,
  description,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  approvals: {},
  artifacts: {},
  interviewHistory: {},
})

export const sanitizeProjectId = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 50)

export const getActiveProjectPath = (workdir: string): string =>
  `${workdir}/${GLOBEX_DIR}/active-project`

export const setActiveProject = async (workdir: string, projectId: string): Promise<void> => {
  const effect = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const basePath = `${workdir}/${GLOBEX_DIR}`
    const activePath = getActiveProjectPath(workdir)
    yield* fs.makeDirectory(basePath, { recursive: true })
    yield* fs.writeFileString(activePath, projectId)
  }).pipe(Effect.provide(NodeFileSystem.layer))
  return Effect.runPromise(effect)
}

export const getActiveProject = async (workdir: string): Promise<string | undefined> => {
  const effect = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const activePath = getActiveProjectPath(workdir)
    const exists = yield* fs.exists(activePath)
    if (!exists) return undefined
    const content = yield* fs.readFileString(activePath)
    return content.trim()
  }).pipe(Effect.provide(NodeFileSystem.layer))
  return Effect.runPromise(effect).catch(() => undefined)
}

export const clearActiveProject = async (workdir: string): Promise<void> => {
  const effect = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const activePath = getActiveProjectPath(workdir)
    const exists = yield* fs.exists(activePath)
    if (exists) {
      yield* fs.remove(activePath)
    }
  }).pipe(Effect.provide(NodeFileSystem.layer))
  return Effect.runPromise(effect).catch(() => undefined)
}
