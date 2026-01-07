import { Effect, Layer } from "effect"
import { NodeFileSystem } from "@effect/platform-node"
import type { GlobexState, Phase, Approval } from "./types.js"

import {
  GlobexPersistence,
  GlobexPersistenceLive,
  StateNotFoundError,
  StateParseError,
  StateWriteError,
  getGlobexDir,
  getStatePath,
  createInitialState
} from "./service.js"

export {
  StateNotFoundError,
  StateParseError,
  StateWriteError,
  getGlobexDir,
  getStatePath,
  createInitialState
}

const PersistenceLayer = GlobexPersistenceLive.pipe(
  Layer.provide(NodeFileSystem.layer)
)

export const readState = (workdir: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.readState(workdir)
  }).pipe(Effect.provide(PersistenceLayer))

export const writeState = (workdir: string, state: GlobexState) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.writeState(workdir, state)
  }).pipe(Effect.provide(PersistenceLayer))

export const updatePhase = (workdir: string, phase: Phase) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.updatePhase(workdir, phase)
  }).pipe(Effect.provide(PersistenceLayer))

export const recordApproval = (
  workdir: string,
  phase: "research" | "plan" | "features",
  approval: Approval
) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.recordApproval(workdir, phase, approval)
  }).pipe(Effect.provide(PersistenceLayer))

export const recordArtifact = (workdir: string, name: string, filePath: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.recordArtifact(workdir, name, filePath)
  }).pipe(Effect.provide(PersistenceLayer))

export const stateExistsEffect = (workdir: string) =>
  Effect.gen(function*() {
    const persistence = yield* GlobexPersistence
    return yield* persistence.stateExists(workdir)
  }).pipe(Effect.provide(PersistenceLayer))

export const stateExists = async (workdir: string): Promise<boolean> =>
  Effect.runPromise(stateExistsEffect(workdir))

export const loadState = async (workdir: string): Promise<GlobexState> =>
  Effect.runPromise(readState(workdir))

export const saveState = async (workdir: string, state: GlobexState): Promise<void> =>
  Effect.runPromise(writeState(workdir, state))
