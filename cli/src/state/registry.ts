import { Effect, Layer, Context } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Schema } from "effect"
import * as os from "node:os"
import * as path from "node:path"

const REGISTRY_DIR = ".globex"
const REGISTRY_FILE = "registry.json"

export const getRegistryPath = (): string =>
  path.join(os.homedir(), REGISTRY_DIR, REGISTRY_FILE)

export interface RegistryEntry {
  name: string
  repoPath: string
  phase: string
  worktreePath?: string
  branchName?: string
  createdAt: string
  updatedAt: string
}

export interface Registry {
  projects: Record<string, RegistryEntry>
}

export class RegistryReadError extends Schema.TaggedError<RegistryReadError>()(
  "RegistryReadError",
  { path: Schema.String, message: Schema.String }
) {}

export class RegistryWriteError extends Schema.TaggedError<RegistryWriteError>()(
  "RegistryWriteError",
  { path: Schema.String, message: Schema.String }
) {}

export class RegistryService extends Context.Tag("RegistryService")<RegistryService, {
  readonly loadRegistry: () => Effect.Effect<Registry, RegistryReadError>
  readonly saveRegistry: (registry: Registry) => Effect.Effect<void, RegistryWriteError>
  readonly getProject: (projectId: string) => Effect.Effect<RegistryEntry | undefined, RegistryReadError>
  readonly upsertProject: (projectId: string, entry: RegistryEntry) => Effect.Effect<void, RegistryReadError | RegistryWriteError>
  readonly removeProject: (projectId: string) => Effect.Effect<void, RegistryReadError | RegistryWriteError>
  readonly listProjects: () => Effect.Effect<Array<{ id: string; entry: RegistryEntry }>, RegistryReadError>
  readonly listProjectsForRepo: (repoPath: string) => Effect.Effect<Array<{ id: string; entry: RegistryEntry }>, RegistryReadError>
}>() {}

export const RegistryServiceLive = Layer.effect(
  RegistryService,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const loadRegistry = (): Effect.Effect<Registry, RegistryReadError> =>
      Effect.gen(function* () {
        const registryPath = getRegistryPath()
        const exists = yield* fs.exists(registryPath).pipe(Effect.orElseSucceed(() => false))
        if (!exists) {
          return { projects: {} }
        }
        const content = yield* fs.readFileString(registryPath).pipe(
          Effect.mapError((e) => new RegistryReadError({ path: registryPath, message: e.message }))
        )
        return yield* Effect.try({
          try: () => JSON.parse(content) as Registry,
          catch: (e) => new RegistryReadError({ path: registryPath, message: e instanceof Error ? e.message : "Unknown parse error" })
        })
      })

    const saveRegistry = (registry: Registry): Effect.Effect<void, RegistryWriteError> =>
      Effect.gen(function* () {
        const registryPath = getRegistryPath()
        const dir = path.dirname(registryPath)
        yield* fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.mapError((e) => new RegistryWriteError({ path: dir, message: e.message }))
        )
        yield* fs.writeFileString(registryPath, JSON.stringify(registry, null, 2)).pipe(
          Effect.mapError((e) => new RegistryWriteError({ path: registryPath, message: e.message }))
        )
      })

    const getProject = (projectId: string): Effect.Effect<RegistryEntry | undefined, RegistryReadError> =>
      Effect.gen(function* () {
        const registry = yield* loadRegistry()
        return registry.projects[projectId]
      })

    const upsertProject = (projectId: string, entry: RegistryEntry): Effect.Effect<void, RegistryReadError | RegistryWriteError> =>
      Effect.gen(function* () {
        const registry = yield* loadRegistry()
        registry.projects[projectId] = { ...entry, updatedAt: new Date().toISOString() }
        yield* saveRegistry(registry)
      })

    const removeProject = (projectId: string): Effect.Effect<void, RegistryReadError | RegistryWriteError> =>
      Effect.gen(function* () {
        const registry = yield* loadRegistry()
        delete registry.projects[projectId]
        yield* saveRegistry(registry)
      })

    const listProjects = (): Effect.Effect<Array<{ id: string; entry: RegistryEntry }>, RegistryReadError> =>
      Effect.gen(function* () {
        const registry = yield* loadRegistry()
        return Object.entries(registry.projects).map(([id, entry]) => ({ id, entry }))
      })

    const listProjectsForRepo = (repoPath: string): Effect.Effect<Array<{ id: string; entry: RegistryEntry }>, RegistryReadError> =>
      Effect.gen(function* () {
        const registry = yield* loadRegistry()
        return Object.entries(registry.projects)
          .filter(([, entry]) => entry.repoPath === repoPath)
          .map(([id, entry]) => ({ id, entry }))
      })

    return {
      loadRegistry,
      saveRegistry,
      getProject,
      upsertProject,
      removeProject,
      listProjects,
      listProjectsForRepo
    }
  })
)

const RegistryLayer = RegistryServiceLive.pipe(
  Layer.provide(NodeFileSystem.layer)
)

export const loadRegistry = () =>
  Effect.gen(function* () {
    const service = yield* RegistryService
    return yield* service.loadRegistry()
  }).pipe(Effect.provide(RegistryLayer))

export const saveRegistry = (registry: Registry) =>
  Effect.gen(function* () {
    const service = yield* RegistryService
    return yield* service.saveRegistry(registry)
  }).pipe(Effect.provide(RegistryLayer))

export const getProject = (projectId: string) =>
  Effect.gen(function* () {
    const service = yield* RegistryService
    return yield* service.getProject(projectId)
  }).pipe(Effect.provide(RegistryLayer))

export const upsertProject = (projectId: string, entry: RegistryEntry) =>
  Effect.gen(function* () {
    const service = yield* RegistryService
    return yield* service.upsertProject(projectId, entry)
  }).pipe(Effect.provide(RegistryLayer))

export const removeProject = (projectId: string) =>
  Effect.gen(function* () {
    const service = yield* RegistryService
    return yield* service.removeProject(projectId)
  }).pipe(Effect.provide(RegistryLayer))

export const listProjects = () =>
  Effect.gen(function* () {
    const service = yield* RegistryService
    return yield* service.listProjects()
  }).pipe(Effect.provide(RegistryLayer))

export const listProjectsForRepo = (repoPath: string) =>
  Effect.gen(function* () {
    const service = yield* RegistryService
    return yield* service.listProjectsForRepo(repoPath)
  }).pipe(Effect.provide(RegistryLayer))
