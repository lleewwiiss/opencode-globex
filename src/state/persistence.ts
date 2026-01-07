import { Effect, Layer } from "effect"
import { NodeFileSystem } from "@effect/platform-node"
import type { GlobexState, Phase, Approval, LoopState } from "./types.js"

import {
  GlobexPersistence,
  GlobexPersistenceLive,
  StateNotFoundError,
  StateParseError,
  StateWriteError,
  getGlobexDir,
  getGlobexBaseDir,
  getProjectDir,
  getStatePath,
  getLoopStatePath,
  createInitialState,
  DEFAULT_PROJECT,
  type ProjectInfo
} from "./service.js"

export {
  StateNotFoundError,
  StateParseError,
  StateWriteError,
  getGlobexDir,
  getGlobexBaseDir,
  getProjectDir,
  getStatePath,
  getLoopStatePath,
  createInitialState,
  DEFAULT_PROJECT,
  type ProjectInfo
}

const PersistenceLayer = GlobexPersistenceLive.pipe(
  Layer.provide(NodeFileSystem.layer)
)

export const readState = (workdir: string, projectId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.readState(workdir, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const writeState = (workdir: string, state: GlobexState, projectId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.writeState(workdir, state, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const updatePhase = (workdir: string, phase: Phase, projectId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.updatePhase(workdir, phase, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const recordApproval = (
  workdir: string,
  phase: "research" | "plan" | "features",
  approval: Approval,
  projectId?: string
) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.recordApproval(workdir, phase, approval, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const recordArtifact = (workdir: string, name: string, filePath: string, projectId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.recordArtifact(workdir, name, filePath, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const stateExistsEffect = (workdir: string, projectId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.stateExists(workdir, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const getActiveProject = (workdir: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.getActiveProject(workdir)
  }).pipe(Effect.provide(PersistenceLayer))

export const setActiveProject = (workdir: string, projectId: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.setActiveProject(workdir, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const listProjects = (workdir: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.listProjects(workdir)
  }).pipe(Effect.provide(PersistenceLayer))

export const migrateIfNeeded = (workdir: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.migrateIfNeeded(workdir)
  }).pipe(Effect.provide(PersistenceLayer))

export const stateExists = async (workdir: string, projectId?: string): Promise<boolean> =>
  Effect.runPromise(stateExistsEffect(workdir, projectId))

export const loadState = async (workdir: string, projectId?: string): Promise<GlobexState> =>
  Effect.runPromise(readState(workdir, projectId))

export const saveState = async (workdir: string, state: GlobexState, projectId?: string): Promise<void> =>
  Effect.runPromise(writeState(workdir, state, projectId))

export const loadLoopState = (workdir: string, projectId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.loadLoopState(workdir, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const saveLoopState = (workdir: string, state: LoopState, projectId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.saveLoopState(workdir, state, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

export const clearLoopState = (workdir: string, projectId?: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.clearLoopState(workdir, projectId)
  }).pipe(Effect.provide(PersistenceLayer))

// Async wrappers for loop state
export const loadLoopStateAsync = async (workdir: string, projectId?: string): Promise<LoopState | null> =>
  Effect.runPromise(loadLoopState(workdir, projectId))

export const saveLoopStateAsync = async (workdir: string, state: LoopState, projectId?: string): Promise<void> =>
  Effect.runPromise(saveLoopState(workdir, state, projectId))

export const clearLoopStateAsync = async (workdir: string, projectId?: string): Promise<void> =>
  Effect.runPromise(clearLoopState(workdir, projectId))
