import { Effect, Layer, Context } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Schema } from "effect"
import * as os from "node:os"
import * as path from "node:path"

const CONFIG_DIR = ".config/globex"
const CONFIG_FILE = "config.json"

export interface GlobexConfig {
  model?: string
  defaultProject?: string
}

const DEFAULT_CONFIG: GlobexConfig = {}

export const getConfigDir = (): string =>
  path.join(os.homedir(), CONFIG_DIR)

export const getConfigPath = (): string =>
  path.join(getConfigDir(), CONFIG_FILE)

export class ConfigReadError extends Schema.TaggedError<ConfigReadError>()(
  "ConfigReadError",
  { path: Schema.String, message: Schema.String }
) {}

export class ConfigWriteError extends Schema.TaggedError<ConfigWriteError>()(
  "ConfigWriteError",
  { path: Schema.String, message: Schema.String }
) {}

export class ConfigService extends Context.Tag("ConfigService")<ConfigService, {
  readonly loadConfig: () => Effect.Effect<GlobexConfig, ConfigReadError>
  readonly saveConfig: (config: GlobexConfig) => Effect.Effect<void, ConfigWriteError>
}>() {}

export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const loadConfig = (): Effect.Effect<GlobexConfig, ConfigReadError> =>
      Effect.gen(function* () {
        const configPath = getConfigPath()
        const exists = yield* fs.exists(configPath).pipe(
          Effect.orElseSucceed(() => false)
        )

        if (!exists) {
          const dir = getConfigDir()
          yield* fs.makeDirectory(dir, { recursive: true }).pipe(
            Effect.mapError((e) => new ConfigReadError({ 
              path: dir, 
              message: `Failed to create config directory: ${e.message}` 
            }))
          )
          yield* fs.writeFileString(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2)).pipe(
            Effect.mapError((e) => new ConfigReadError({ 
              path: configPath, 
              message: `Failed to write default config: ${e.message}` 
            }))
          )
          return DEFAULT_CONFIG
        }

        const content = yield* fs.readFileString(configPath).pipe(
          Effect.mapError((e) => new ConfigReadError({ 
            path: configPath, 
            message: `Failed to read config: ${e.message}` 
          }))
        )

        return yield* Effect.try({
          try: () => {
            const parsed = JSON.parse(content) as GlobexConfig
            return { ...DEFAULT_CONFIG, ...parsed }
          },
          catch: (e) => new ConfigReadError({ 
            path: configPath, 
            message: `Failed to parse config: ${e instanceof Error ? e.message : "Unknown error"}` 
          })
        })
      })

    const saveConfig = (config: GlobexConfig): Effect.Effect<void, ConfigWriteError> =>
      Effect.gen(function* () {
        const dir = getConfigDir()
        const configPath = getConfigPath()
        yield* fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.mapError((e) => new ConfigWriteError({ 
            path: dir, 
            message: `Failed to create config directory: ${e.message}` 
          }))
        )
        yield* fs.writeFileString(configPath, JSON.stringify(config, null, 2)).pipe(
          Effect.mapError((e) => new ConfigWriteError({ 
            path: configPath, 
            message: `Failed to write config: ${e.message}` 
          }))
        )
      })

    return { loadConfig, saveConfig }
  })
)

const ConfigLayer = ConfigServiceLive.pipe(
  Layer.provide(NodeFileSystem.layer)
)

export const loadConfigEffect = () =>
  Effect.gen(function* () {
    const service = yield* ConfigService
    return yield* service.loadConfig()
  }).pipe(Effect.provide(ConfigLayer))

export const saveConfigEffect = (config: GlobexConfig) =>
  Effect.gen(function* () {
    const service = yield* ConfigService
    return yield* service.saveConfig(config)
  }).pipe(Effect.provide(ConfigLayer))

export const loadConfig = async (): Promise<GlobexConfig> =>
  Effect.runPromise(loadConfigEffect())

export const saveConfig = async (config: GlobexConfig): Promise<void> =>
  Effect.runPromise(saveConfigEffect(config))
