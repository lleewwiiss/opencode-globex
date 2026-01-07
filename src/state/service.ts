import { Context, Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import { Schema } from "effect"
import type { GlobexState, Phase, Approval } from "./types.js"

const GLOBEX_DIR = ".globex"
const STATE_FILE = "state.json"

export const getGlobexDir = (workdir: string): string => `${workdir}/${GLOBEX_DIR}`

export const getStatePath = (workdir: string): string => `${getGlobexDir(workdir)}/${STATE_FILE}`

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

export class GlobexPersistence extends Context.Tag("GlobexPersistence")<GlobexPersistence, {
  readonly readState: (workdir: string) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError>
  readonly writeState: (workdir: string, state: GlobexState) => Effect.Effect<void, StateWriteError>
  readonly stateExists: (workdir: string) => Effect.Effect<boolean>
  readonly updatePhase: (workdir: string, phase: Phase) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError>
  readonly recordApproval: (workdir: string, phase: "research" | "plan" | "features", approval: Approval) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError>
  readonly recordArtifact: (workdir: string, name: string, filePath: string) => Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError>
}>() {}

export const GlobexPersistenceLive = Layer.effect(
  GlobexPersistence,
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    const readState = (workdir: string): Effect.Effect<GlobexState, StateNotFoundError | StateParseError> => {
      const path = getStatePath(workdir)
      return Effect.gen(function*() {
        const content = yield* fs.readFileString(path).pipe(
          Effect.mapError(() => new StateNotFoundError({ path }))
        )
        return yield* Effect.try({
          try: () => JSON.parse(content) as GlobexState,
          catch: (e) => new StateParseError({ message: e instanceof Error ? e.message : "Unknown parse error" })
        })
      })
    }

    const writeState = (workdir: string, state: GlobexState): Effect.Effect<void, StateWriteError> => {
      const dir = getGlobexDir(workdir)
      const path = getStatePath(workdir)
      const updatedState = { ...state, updatedAt: new Date().toISOString() }
      return Effect.gen(function*() {
        yield* fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.mapError((e) => new StateWriteError({ path: dir, message: e.message }))
        )
        yield* fs.writeFileString(path, JSON.stringify(updatedState, null, 2)).pipe(
          Effect.mapError((e) => new StateWriteError({ path, message: e.message }))
        )
      })
    }

    const stateExists = (workdir: string): Effect.Effect<boolean> => {
      const path = getStatePath(workdir)
      return fs.exists(path).pipe(Effect.orElseSucceed(() => false))
    }

    const updatePhase = (workdir: string, phase: Phase): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
      Effect.gen(function*() {
        const state = yield* readState(workdir)
        const updated = { ...state, currentPhase: phase }
        yield* writeState(workdir, updated)
        return { ...updated, updatedAt: new Date().toISOString() }
      })

    const recordApproval = (workdir: string, phase: "research" | "plan" | "features", approval: Approval): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
      Effect.gen(function*() {
        const state = yield* readState(workdir)
        const updated: GlobexState = {
          ...state,
          approvals: { ...state.approvals, [phase]: approval }
        }
        yield* writeState(workdir, updated)
        return { ...updated, updatedAt: new Date().toISOString() }
      })

    const recordArtifact = (workdir: string, name: string, filePath: string): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
      Effect.gen(function*() {
        const state = yield* readState(workdir)
        const updated: GlobexState = {
          ...state,
          artifacts: { ...state.artifacts, [name]: filePath }
        }
        yield* writeState(workdir, updated)
        return { ...updated, updatedAt: new Date().toISOString() }
      })

    return {
      readState,
      writeState,
      stateExists,
      updatePhase,
      recordApproval,
      recordArtifact
    }
  })
)
