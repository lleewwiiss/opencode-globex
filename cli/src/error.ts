import { Effect, Layer, Context } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Schema } from "effect"
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Feature } from "./state/schema.js"
import type { GlobexState } from "./state/types.js"
import { getProjectDir, writeState } from "./state/persistence.js"
import { updateFeature } from "./features/manager.js"

const ERROR_LOG_FILE = "errors.log"

export type ErrorType = "session_timeout" | "server_disconnect" | "uncaught_exception"

export class SessionTimeoutError extends Schema.TaggedError<SessionTimeoutError>()(
  "SessionTimeoutError",
  { sessionId: Schema.String, featureId: Schema.String, attempt: Schema.Number }
) {}

export class ServerDisconnectError extends Schema.TaggedError<ServerDisconnectError>()(
  "ServerDisconnectError",
  { url: Schema.String, message: Schema.String }
) {}

export class UncaughtExceptionError extends Schema.TaggedError<UncaughtExceptionError>()(
  "UncaughtExceptionError",
  { message: Schema.String, stack: Schema.optional(Schema.String) }
) {}

export class ErrorLogWriteError extends Schema.TaggedError<ErrorLogWriteError>()(
  "ErrorLogWriteError",
  { path: Schema.String, message: Schema.String }
) {}

export interface ErrorContext {
  workdir: string
  projectId: string
  featureId?: string
  sessionId?: string
}

export interface RecoveryResult {
  recovered: boolean
  shouldRetry: boolean
  shouldBlock: boolean
  error?: string
}

interface RetryState {
  sessionTimeoutRetries: Map<string, number>
  reconnectAttempts: number
}

const retryState: RetryState = {
  sessionTimeoutRetries: new Map(),
  reconnectAttempts: 0,
}

const MAX_SESSION_TIMEOUT_RETRIES = 1
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 2000

export class ErrorRecoveryService extends Context.Tag("ErrorRecoveryService")<
  ErrorRecoveryService,
  {
    readonly handleSessionTimeout: (
      ctx: ErrorContext,
      error: SessionTimeoutError
    ) => Effect.Effect<RecoveryResult>
    readonly handleServerDisconnect: (
      ctx: ErrorContext,
      client: OpencodeClient,
      error: ServerDisconnectError
    ) => Effect.Effect<RecoveryResult>
    readonly handleUncaughtException: (
      ctx: ErrorContext,
      error: UncaughtExceptionError,
      state: GlobexState
    ) => Effect.Effect<never, never, never>
    readonly logError: (
      ctx: ErrorContext,
      errorType: ErrorType,
      message: string
    ) => Effect.Effect<void, ErrorLogWriteError>
    readonly resetRetryState: () => void
  }
>() {}

export const ErrorRecoveryServiceLive = Layer.effect(
  ErrorRecoveryService,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const getErrorLogPath = (workdir: string, projectId: string): string =>
      `${getProjectDir(workdir, projectId)}/${ERROR_LOG_FILE}`

    const logError = (
      ctx: ErrorContext,
      errorType: ErrorType,
      message: string
    ): Effect.Effect<void, ErrorLogWriteError> =>
      Effect.gen(function* () {
        const logPath = getErrorLogPath(ctx.workdir, ctx.projectId)
        const timestamp = new Date().toISOString()
        const entry = `[${timestamp}] ${errorType}: ${message}\n`

        const exists = yield* fs.exists(logPath).pipe(Effect.orElseSucceed(() => false))
        const currentContent = exists
          ? yield* fs.readFileString(logPath).pipe(Effect.orElseSucceed(() => ""))
          : ""

        yield* fs
          .writeFileString(logPath, currentContent + entry)
          .pipe(
            Effect.mapError(
              (e) => new ErrorLogWriteError({ path: logPath, message: e.message })
            )
          )
      })

    const handleSessionTimeout = (
      ctx: ErrorContext,
      error: SessionTimeoutError
    ): Effect.Effect<RecoveryResult> =>
      Effect.gen(function* () {
        const key = `${ctx.featureId ?? error.featureId}`
        const currentRetries = retryState.sessionTimeoutRetries.get(key) ?? 0

        yield* logError(ctx, "session_timeout", `Session ${error.sessionId} timed out for feature ${error.featureId} (attempt ${currentRetries + 1})`).pipe(
          Effect.catchAll(() => Effect.void)
        )

        if (currentRetries < MAX_SESSION_TIMEOUT_RETRIES) {
          retryState.sessionTimeoutRetries.set(key, currentRetries + 1)
          return { recovered: true, shouldRetry: true, shouldBlock: false }
        }

        retryState.sessionTimeoutRetries.delete(key)
        return {
          recovered: false,
          shouldRetry: false,
          shouldBlock: true,
          error: `Session timeout after ${MAX_SESSION_TIMEOUT_RETRIES + 1} attempts`,
        }
      })

    const handleServerDisconnect = (
      ctx: ErrorContext,
      client: OpencodeClient,
      error: ServerDisconnectError
    ): Effect.Effect<RecoveryResult> =>
      Effect.gen(function* () {
        yield* logError(ctx, "server_disconnect", `Disconnected from ${error.url}: ${error.message}`).pipe(
          Effect.catchAll(() => Effect.void)
        )

        while (retryState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          retryState.reconnectAttempts++

          yield* Effect.sleep(RECONNECT_DELAY_MS)

          const connected = yield* Effect.tryPromise({
            try: async () => {
              const status = await client.session.status()
              return status.data !== undefined
            },
            catch: () => false,
          }).pipe(Effect.orElseSucceed(() => false))

          if (connected) {
            retryState.reconnectAttempts = 0
            return { recovered: true, shouldRetry: true, shouldBlock: false }
          }
        }

        retryState.reconnectAttempts = 0
        return {
          recovered: false,
          shouldRetry: false,
          shouldBlock: false,
          error: `Server reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts`,
        }
      })

    const handleUncaughtException = (
      ctx: ErrorContext,
      error: UncaughtExceptionError,
      state: GlobexState
    ): Effect.Effect<never, never, never> =>
      Effect.gen(function* () {
        const message = error.stack
          ? `${error.message}\n${error.stack}`
          : error.message

        yield* logError(ctx, "uncaught_exception", message).pipe(
          Effect.catchAll(() => Effect.void)
        )

        yield* writeState(ctx.workdir, ctx.projectId, state).pipe(
          Effect.catchAll(() => Effect.void)
        )

        yield* Effect.sync(() => {
          console.error(`Fatal error: ${error.message}`)
          process.exit(1)
        })

        return yield* Effect.never
      })

    const resetRetryState = (): void => {
      retryState.sessionTimeoutRetries.clear()
      retryState.reconnectAttempts = 0
    }

    return {
      handleSessionTimeout,
      handleServerDisconnect,
      handleUncaughtException,
      logError,
      resetRetryState,
    }
  })
)

const ErrorRecoveryLayer = ErrorRecoveryServiceLive.pipe(
  Layer.provide(NodeFileSystem.layer)
)

export const handleSessionTimeout = (ctx: ErrorContext, error: SessionTimeoutError) =>
  Effect.gen(function* () {
    const service = yield* ErrorRecoveryService
    return yield* service.handleSessionTimeout(ctx, error)
  }).pipe(Effect.provide(ErrorRecoveryLayer))

export const handleServerDisconnect = (
  ctx: ErrorContext,
  client: OpencodeClient,
  error: ServerDisconnectError
) =>
  Effect.gen(function* () {
    const service = yield* ErrorRecoveryService
    return yield* service.handleServerDisconnect(ctx, client, error)
  }).pipe(Effect.provide(ErrorRecoveryLayer))

export const handleUncaughtException = (
  ctx: ErrorContext,
  error: UncaughtExceptionError,
  state: GlobexState
) =>
  Effect.gen(function* () {
    const service = yield* ErrorRecoveryService
    return yield* service.handleUncaughtException(ctx, error, state)
  }).pipe(Effect.provide(ErrorRecoveryLayer))

export const logError = (ctx: ErrorContext, errorType: ErrorType, message: string) =>
  Effect.gen(function* () {
    const service = yield* ErrorRecoveryService
    return yield* service.logError(ctx, errorType, message)
  }).pipe(Effect.provide(ErrorRecoveryLayer))

export const resetRetryState = () =>
  Effect.gen(function* () {
    const service = yield* ErrorRecoveryService
    service.resetRetryState()
  }).pipe(Effect.provide(ErrorRecoveryLayer))

export const recoverSessionTimeout = async (
  ctx: ErrorContext,
  sessionId: string,
  featureId: string,
  attempt: number
): Promise<RecoveryResult> => {
  const error = new SessionTimeoutError({ sessionId, featureId, attempt })
  return Effect.runPromise(handleSessionTimeout(ctx, error))
}

export const recoverServerDisconnect = async (
  ctx: ErrorContext,
  client: OpencodeClient,
  url: string,
  message: string
): Promise<RecoveryResult> => {
  const error = new ServerDisconnectError({ url, message })
  return Effect.runPromise(handleServerDisconnect(ctx, client, error))
}

export const handleFatalError = async (
  ctx: ErrorContext,
  error: Error,
  state: GlobexState
): Promise<never> => {
  const wrapped = new UncaughtExceptionError({
    message: error.message,
    stack: error.stack,
  })
  return Effect.runPromise(handleUncaughtException(ctx, wrapped, state))
}

export const markFeatureBlockedOnTimeout = (
  features: Feature[],
  featureId: string,
  reason: string
): Feature[] =>
  updateFeature(features, featureId, {
    blocked: true,
    blockedReason: reason,
  })

export const writeErrorLog = async (
  ctx: ErrorContext,
  errorType: ErrorType,
  message: string
): Promise<void> =>
  Effect.runPromise(logError(ctx, errorType, message).pipe(Effect.catchAll(() => Effect.void)))
