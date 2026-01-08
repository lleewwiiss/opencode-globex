import { Effect, Layer, Context, Schema } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import type { Feature } from "./schema.js"
import { getProjectDir } from "./persistence.js"

const FEATURES_FILE = "features.json"
const REJECTION_FILE = ".globex-rejected"

export interface RejectionInfo {
  featureId: string
  reasons: string[]
}

export class FeatureReadError extends Schema.TaggedError<FeatureReadError>()(
  "FeatureReadError",
  { path: Schema.String, message: Schema.String }
) {}

export class FeatureWriteError extends Schema.TaggedError<FeatureWriteError>()(
  "FeatureWriteError",
  { path: Schema.String, message: Schema.String }
) {}

export interface FeaturesData {
  features: Feature[]
  summary: string
}

export class FeaturePersistence extends Context.Tag("FeaturePersistence")<FeaturePersistence, {
  readonly readFeatures: (workdir: string, projectId: string) => Effect.Effect<Feature[], FeatureReadError>
  readonly readFeaturesWithSummary: (workdir: string, projectId: string) => Effect.Effect<FeaturesData, FeatureReadError>
  readonly writeFeatures: (workdir: string, projectId: string, features: Feature[]) => Effect.Effect<void, FeatureWriteError>
  readonly readRejectionInfo: (workdir: string) => Effect.Effect<RejectionInfo | null>
}>() {}

export const FeaturePersistenceLive = Layer.effect(
  FeaturePersistence,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const readFeaturesWithSummary = (workdir: string, projectId: string): Effect.Effect<FeaturesData, FeatureReadError> =>
      Effect.gen(function* () {
        const path = `${getProjectDir(workdir, projectId)}/${FEATURES_FILE}`
        const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false))
        if (!exists) return { features: [], summary: "" }

        const content = yield* fs.readFileString(path).pipe(
          Effect.mapError((e) => new FeatureReadError({ path, message: e.message }))
        )

        return yield* Effect.try({
          try: () => {
            const parsed = JSON.parse(content) as { features: Feature[], summary?: string }
            return { features: parsed.features, summary: parsed.summary ?? "" }
          },
          catch: (e) => new FeatureReadError({
            path,
            message: e instanceof Error ? e.message : "Unknown parse error"
          })
        })
      })

    const readFeatures = (workdir: string, projectId: string): Effect.Effect<Feature[], FeatureReadError> =>
      readFeaturesWithSummary(workdir, projectId).pipe(
        Effect.map((data) => data.features)
      )

    const writeFeatures = (workdir: string, projectId: string, features: Feature[]): Effect.Effect<void, FeatureWriteError> =>
      Effect.gen(function* () {
        const dir = getProjectDir(workdir, projectId)
        const path = `${dir}/${FEATURES_FILE}`
        const content = JSON.stringify({ features }, null, 2)

        yield* fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.mapError((e) => new FeatureWriteError({ path: dir, message: e.message }))
        )
        yield* fs.writeFileString(path, content).pipe(
          Effect.mapError((e) => new FeatureWriteError({ path, message: e.message }))
        )
      })

    const readRejectionInfo = (workdir: string): Effect.Effect<RejectionInfo | null> =>
      Effect.gen(function* () {
        const path = `${workdir}/${REJECTION_FILE}`
        const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false))
        if (!exists) return null

        const content = yield* fs.readFileString(path).pipe(
          Effect.orElseSucceed(() => "")
        )
        if (!content) return null

        try {
          return JSON.parse(content) as RejectionInfo
        } catch {
          return null
        }
      })

    return { readFeatures, readFeaturesWithSummary, writeFeatures, readRejectionInfo }
  })
)

const FeaturePersistenceLayer = FeaturePersistenceLive.pipe(
  Layer.provide(NodeFileSystem.layer)
)

export const readFeaturesEffect = (workdir: string, projectId: string) =>
  Effect.gen(function* () {
    const service = yield* FeaturePersistence
    return yield* service.readFeatures(workdir, projectId)
  }).pipe(Effect.provide(FeaturePersistenceLayer))

export const writeFeaturesEffect = (workdir: string, projectId: string, features: Feature[]) =>
  Effect.gen(function* () {
    const service = yield* FeaturePersistence
    return yield* service.writeFeatures(workdir, projectId, features)
  }).pipe(Effect.provide(FeaturePersistenceLayer))

export const readFeaturesWithSummaryEffect = (workdir: string, projectId: string) =>
  Effect.gen(function* () {
    const service = yield* FeaturePersistence
    return yield* service.readFeaturesWithSummary(workdir, projectId)
  }).pipe(Effect.provide(FeaturePersistenceLayer))

export const readRejectionInfoEffect = (workdir: string) =>
  Effect.gen(function* () {
    const service = yield* FeaturePersistence
    return yield* service.readRejectionInfo(workdir)
  }).pipe(Effect.provide(FeaturePersistenceLayer))

export const readFeatures = async (workdir: string, projectId: string): Promise<Feature[]> =>
  Effect.runPromise(readFeaturesEffect(workdir, projectId))

export const readFeaturesWithSummary = async (workdir: string, projectId: string): Promise<FeaturesData> =>
  Effect.runPromise(readFeaturesWithSummaryEffect(workdir, projectId))

export const writeFeatures = async (workdir: string, projectId: string, features: Feature[]): Promise<void> =>
  Effect.runPromise(writeFeaturesEffect(workdir, projectId, features))

export const readRejectionInfo = async (workdir: string): Promise<RejectionInfo | null> =>
  Effect.runPromise(readRejectionInfoEffect(workdir))
