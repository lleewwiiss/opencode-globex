import { Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Schema } from "effect"
import {
  validateFeaturesJson,
  validateCitationsJson,
  validateRisksJson,
  type ValidationResult,
} from "./validators.js"
import {
  readState,
  writeState,
  getProjectDir,
} from "../state/persistence.js"
import { transitionPhase } from "../phases/engine.js"
import type { GlobexState, Phase } from "../state/types.js"

export class ArtifactValidationError extends Schema.TaggedError<ArtifactValidationError>()(
  "ArtifactValidationError",
  {
    artifact: Schema.String,
    errors: Schema.Array(Schema.Struct({
      path: Schema.String,
      message: Schema.String,
    })),
  }
) {}

export class ArtifactWriteError extends Schema.TaggedError<ArtifactWriteError>()(
  "ArtifactWriteError",
  { artifact: Schema.String, message: Schema.String }
) {}

type JsonArtifact = "features.json" | "citations.json" | "risks.json"

const JSON_VALIDATORS: Record<JsonArtifact, (content: string) => ValidationResult<unknown>> = {
  "features.json": validateFeaturesJson,
  "citations.json": validateCitationsJson,
  "risks.json": validateRisksJson,
}

const ARTIFACT_PHASE_TRANSITIONS: Partial<Record<string, Phase>> = {
  "research.md": "research_interview",
  "plan.md": "plan_interview",
  "features.json": "execute",
}

const isJsonArtifact = (name: string): name is JsonArtifact =>
  name in JSON_VALIDATORS

const validateJsonArtifact = (
  name: JsonArtifact,
  content: string
): Effect.Effect<void, ArtifactValidationError> =>
  Effect.gen(function* () {
    const validator = JSON_VALIDATORS[name]
    const result = validator(content)
    if (!result.success && result.errors) {
      return yield* Effect.fail(
        new ArtifactValidationError({ artifact: name, errors: result.errors })
      )
    }
  })

const writeArtifactFile = (
  workdir: string,
  projectId: string,
  name: string,
  content: string
): Effect.Effect<void, ArtifactWriteError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = getProjectDir(workdir, projectId)
    const path = `${dir}/${name}`

    yield* fs.makeDirectory(dir, { recursive: true }).pipe(
      Effect.mapError((e) => new ArtifactWriteError({ artifact: name, message: e.message }))
    )
    yield* fs.writeFileString(path, content).pipe(
      Effect.mapError((e) => new ArtifactWriteError({ artifact: name, message: e.message }))
    )
  })

const updateStateArtifacts = (
  workdir: string,
  projectId: string,
  name: string
): Effect.Effect<GlobexState, Error> =>
  Effect.gen(function* () {
    const state = yield* readState(workdir, projectId).pipe(
      Effect.mapError((e) => new Error(`Failed to read state: ${e._tag}`))
    )
    const updated: GlobexState = {
      ...state,
      artifacts: { ...state.artifacts, [name]: new Date().toISOString() },
    }
    yield* writeState(workdir, projectId, updated).pipe(
      Effect.mapError((e) => new Error(`Failed to write state: ${e._tag}`))
    )
    return updated
  })

const maybeTransitionPhase = (
  workdir: string,
  projectId: string,
  state: GlobexState,
  artifactName: string
): Effect.Effect<GlobexState, Error> =>
  Effect.gen(function* () {
    const targetPhase = ARTIFACT_PHASE_TRANSITIONS[artifactName]
    if (!targetPhase) return state

    const transitioned = yield* transitionPhase(state, targetPhase).pipe(
      Effect.mapError((e) => new Error(`Invalid transition: ${e.from} -> ${e.to}`))
    )
    yield* writeState(workdir, projectId, transitioned).pipe(
      Effect.mapError((e) => new Error(`Failed to write state: ${e._tag}`))
    )
    return transitioned
  })

export interface SaveArtifactResult {
  success: boolean
  artifact: string
  phaseTransitioned?: Phase
  error?: string
}

export const saveArtifact = (
  workdir: string,
  projectId: string,
  name: string,
  content: string
): Effect.Effect<SaveArtifactResult, never> =>
  Effect.gen(function* () {
    if (isJsonArtifact(name)) {
      const validationResult = yield* validateJsonArtifact(name, content).pipe(
        Effect.either
      )
      if (validationResult._tag === "Left") {
        const err = validationResult.left
        return {
          success: false,
          artifact: name,
          error: `Validation failed: ${err.errors.map(e => `${e.path}: ${e.message}`).join("; ")}`,
        }
      }
    }

    const writeResult = yield* writeArtifactFile(workdir, projectId, name, content).pipe(
      Effect.provide(NodeFileSystem.layer as Layer.Layer<FileSystem.FileSystem>),
      Effect.either
    )
    if (writeResult._tag === "Left") {
      return {
        success: false,
        artifact: name,
        error: `Write failed: ${writeResult.left.message}`,
      }
    }

    const stateResult = yield* updateStateArtifacts(workdir, projectId, name).pipe(
      Effect.either
    )
    if (stateResult._tag === "Left") {
      return {
        success: false,
        artifact: name,
        error: stateResult.left.message,
      }
    }

    const transitionResult = yield* maybeTransitionPhase(
      workdir,
      projectId,
      stateResult.right,
      name
    ).pipe(Effect.either)

    if (transitionResult._tag === "Left") {
      return {
        success: true,
        artifact: name,
        error: `Saved but transition failed: ${transitionResult.left.message}`,
      }
    }

    const phaseChanged = transitionResult.right.currentPhase !== stateResult.right.currentPhase
    return {
      success: true,
      artifact: name,
      phaseTransitioned: phaseChanged ? transitionResult.right.currentPhase : undefined,
    }
  })

export const saveArtifactAsync = async (
  workdir: string,
  projectId: string,
  name: string,
  content: string
): Promise<SaveArtifactResult> =>
  Effect.runPromise(saveArtifact(workdir, projectId, name, content))
