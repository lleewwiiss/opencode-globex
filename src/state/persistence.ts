import { Effect, Data } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { GlobexState, Phase, Approval } from "./types.js"

const GLOBEX_DIR = ".globex"
const STATE_FILE = "state.json"

export class StateNotFoundError extends Data.TaggedError("StateNotFoundError")<{
  readonly path: string
}> {}

export class StateParseError extends Data.TaggedError("StateParseError")<{
  readonly cause: unknown
}> {}

export class StateWriteError extends Data.TaggedError("StateWriteError")<{
  readonly cause: unknown
}> {}

export const getGlobexDir = (workdir: string): string => 
  path.join(workdir, GLOBEX_DIR)

export const getStatePath = (workdir: string): string =>
  path.join(getGlobexDir(workdir), STATE_FILE)

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

export const readState = (workdir: string): Effect.Effect<GlobexState, StateNotFoundError | StateParseError> =>
  Effect.tryPromise({
    try: async () => {
      const statePath = getStatePath(workdir)
      const content = await fs.readFile(statePath, "utf-8")
      return JSON.parse(content) as GlobexState
    },
    catch: (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return new StateNotFoundError({ path: getStatePath(workdir) })
      }
      return new StateParseError({ cause: error })
    }
  }).pipe(
    Effect.flatMap((result) => {
      if (result instanceof StateNotFoundError || result instanceof StateParseError) {
        return Effect.fail(result)
      }
      return Effect.succeed(result)
    })
  )

export const writeState = (workdir: string, state: GlobexState): Effect.Effect<void, StateWriteError> =>
  Effect.tryPromise({
    try: async () => {
      const globexDir = getGlobexDir(workdir)
      await fs.mkdir(globexDir, { recursive: true })
      const statePath = getStatePath(workdir)
      const updatedState = { ...state, updatedAt: new Date().toISOString() }
      await fs.writeFile(statePath, JSON.stringify(updatedState, null, 2))
    },
    catch: (error) => new StateWriteError({ cause: error })
  })

export const updatePhase = (workdir: string, phase: Phase): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
  Effect.gen(function* () {
    const state = yield* readState(workdir)
    const newState = { ...state, currentPhase: phase }
    yield* writeState(workdir, newState)
    return newState
  })

export const recordApproval = (
  workdir: string, 
  phase: "research" | "plan" | "features",
  approval: Approval
): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
  Effect.gen(function* () {
    const state = yield* readState(workdir)
    const newState = {
      ...state,
      approvals: { ...state.approvals, [phase]: approval }
    }
    yield* writeState(workdir, newState)
    return newState
  })

export const recordArtifact = (
  workdir: string,
  name: string,
  filePath: string
): Effect.Effect<GlobexState, StateNotFoundError | StateParseError | StateWriteError> =>
  Effect.gen(function* () {
    const state = yield* readState(workdir)
    const newState = {
      ...state,
      artifacts: { ...state.artifacts, [name]: filePath }
    }
    yield* writeState(workdir, newState)
    return newState
  })

export const stateExists = (workdir: string): Effect.Effect<boolean, never> =>
  Effect.tryPromise({
    try: async () => {
      await fs.access(getStatePath(workdir))
      return true
    },
    catch: () => false
  }).pipe(Effect.orElse(() => Effect.succeed(false)))

export const loadState = async (workdir: string): Promise<GlobexState> => {
  const statePath = getStatePath(workdir)
  const content = await fs.readFile(statePath, "utf-8")
  return JSON.parse(content) as GlobexState
}

export const saveState = async (workdir: string, state: GlobexState): Promise<void> => {
  const globexDir = getGlobexDir(workdir)
  await fs.mkdir(globexDir, { recursive: true })
  const statePath = getStatePath(workdir)
  const updatedState = { ...state, updatedAt: new Date().toISOString() }
  await fs.writeFile(statePath, JSON.stringify(updatedState, null, 2))
}
