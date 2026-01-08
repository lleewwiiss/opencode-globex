import { Effect, Layer, Context, Schema } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"

export const SignalType = Schema.Union(
  Schema.Literal("done"),
  Schema.Literal("approved"),
  Schema.Literal("rejected"),
  Schema.Literal("pause")
)
export type SignalType = Schema.Schema.Type<typeof SignalType>

const SIGNAL_FILES: Record<SignalType, string> = {
  done: ".globex-done",
  approved: ".globex-approved",
  rejected: ".globex-rejected",
  pause: ".globex-pause",
}

const ALL_SIGNAL_TYPES: SignalType[] = ["done", "approved", "rejected", "pause"]

export class SignalError extends Schema.TaggedError<SignalError>()(
  "SignalError",
  { message: Schema.String }
) {}

export class SignalTimeoutError extends Schema.TaggedError<SignalTimeoutError>()(
  "SignalTimeoutError",
  { signal: SignalType, timeoutMs: Schema.Number }
) {}

const getSignalPath = (workdir: string, type: SignalType): string =>
  `${workdir}/${SIGNAL_FILES[type]}`

export class SignalService extends Context.Tag("SignalService")<SignalService, {
  readonly checkSignal: (workdir: string, type: SignalType) => Effect.Effect<boolean>
  readonly createSignal: (workdir: string, type: SignalType) => Effect.Effect<void, SignalError>
  readonly clearSignals: (workdir: string) => Effect.Effect<void, SignalError>
  readonly watchForSignal: (workdir: string, type: SignalType, timeoutMs: number) => Effect.Effect<boolean, SignalTimeoutError>
}>() {}

export const SignalServiceLive = Layer.effect(
  SignalService,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const checkSignal = (workdir: string, type: SignalType): Effect.Effect<boolean> =>
      fs.exists(getSignalPath(workdir, type)).pipe(
        Effect.orElseSucceed(() => false)
      )

    const createSignal = (workdir: string, type: SignalType): Effect.Effect<void, SignalError> =>
      fs.writeFileString(getSignalPath(workdir, type), "").pipe(
        Effect.mapError((e) => new SignalError({ message: `Failed to create ${type} signal: ${e.message}` }))
      )

    const clearSignals = (workdir: string): Effect.Effect<void, SignalError> =>
      Effect.gen(function* () {
        for (const type of ALL_SIGNAL_TYPES) {
          const path = getSignalPath(workdir, type)
          const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false))
          if (exists) {
            yield* fs.remove(path).pipe(
              Effect.mapError((e) => new SignalError({ message: `Failed to remove ${type} signal: ${e.message}` }))
            )
          }
        }
      })

    const watchForSignal = (workdir: string, type: SignalType, timeoutMs: number): Effect.Effect<boolean, SignalTimeoutError> =>
      Effect.gen(function* () {
        const pollIntervalMs = 100
        const maxIterations = Math.ceil(timeoutMs / pollIntervalMs)

        for (let i = 0; i < maxIterations; i++) {
          const exists = yield* checkSignal(workdir, type)
          if (exists) return true
          yield* Effect.sleep(pollIntervalMs)
        }

        return yield* Effect.fail(new SignalTimeoutError({ signal: type, timeoutMs }))
      })

    return { checkSignal, createSignal, clearSignals, watchForSignal }
  })
)

const SignalLayer = SignalServiceLive.pipe(
  Layer.provide(NodeFileSystem.layer)
)

export const checkSignalEffect = (workdir: string, type: SignalType) =>
  Effect.gen(function* () {
    const service = yield* SignalService
    return yield* service.checkSignal(workdir, type)
  }).pipe(Effect.provide(SignalLayer))

export const createSignalEffect = (workdir: string, type: SignalType) =>
  Effect.gen(function* () {
    const service = yield* SignalService
    return yield* service.createSignal(workdir, type)
  }).pipe(Effect.provide(SignalLayer))

export const clearSignalsEffect = (workdir: string) =>
  Effect.gen(function* () {
    const service = yield* SignalService
    return yield* service.clearSignals(workdir)
  }).pipe(Effect.provide(SignalLayer))

export const watchForSignalEffect = (workdir: string, type: SignalType, timeoutMs: number) =>
  Effect.gen(function* () {
    const service = yield* SignalService
    return yield* service.watchForSignal(workdir, type, timeoutMs)
  }).pipe(Effect.provide(SignalLayer))

export const checkSignal = async (workdir: string, type: SignalType): Promise<boolean> =>
  Effect.runPromise(checkSignalEffect(workdir, type))

export const createSignal = async (workdir: string, type: SignalType): Promise<void> =>
  Effect.runPromise(createSignalEffect(workdir, type))

export const clearSignals = async (workdir: string): Promise<void> =>
  Effect.runPromise(clearSignalsEffect(workdir))

export const watchForSignal = async (workdir: string, type: SignalType, timeoutMs: number): Promise<boolean> =>
  Effect.runPromise(watchForSignalEffect(workdir, type, timeoutMs))
