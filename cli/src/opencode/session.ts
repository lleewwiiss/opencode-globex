import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import { log } from "../util/log.js"

export interface SpawnSessionResult {
  sessionId: string
}

/**
 * Parse model string into provider/model parts.
 * @param model Format: "provider/model" (e.g., "anthropic/claude-opus-4")
 */
export function parseModel(model: string): { providerID: string; modelID: string } {
  const slashIndex = model.indexOf("/")
  if (slashIndex === -1) {
    throw new Error(
      `Invalid model format: "${model}". Expected "provider/model" (e.g., "anthropic/claude-opus-4")`
    )
  }
  return {
    providerID: model.slice(0, slashIndex),
    modelID: model.slice(slashIndex + 1),
  }
}

/**
 * Create a new session with an initial prompt.
 * DEPRECATED: Use runAgentSession instead to avoid race conditions.
 * @returns The session ID
 */
export async function spawnAgentSession(
  client: OpencodeClient,
  prompt: string,
  model: string
): Promise<string> {
  const createResult = await client.session.create()
  if (!createResult.data?.id) {
    throw new Error("Failed to create session: no session ID returned")
  }

  const sessionId = createResult.data.id
  const { providerID, modelID } = parseModel(model)

  await client.session.prompt({
    sessionID: sessionId,
    model: { providerID, modelID },
    parts: [{ type: "text", text: prompt }],
  })

  return sessionId
}

export interface ToolEvent {
  sessionId: string
  toolName: string
  title: string
  timestamp: number
}

export interface RunAgentSessionCallbacks {
  onToolEvent: (event: ToolEvent) => void
  onComplete: () => void
  onError: (error: Error) => void
}

export interface RunAgentSessionOptions {
  client: OpencodeClient
  prompt: string
  model: string
  variant?: string
  signal?: AbortSignal
  callbacks: RunAgentSessionCallbacks
}

/**
 * Run an agent session with proper event subscription order.
 * 1. Create session
 * 2. Subscribe to events
 * 3. Wait for server.connected
 * 4. Send prompt (ensures no events are missed)
 * 5. Stream events until session.idle
 */
export async function runAgentSession(options: RunAgentSessionOptions): Promise<string> {
  const { client, prompt, model, variant, signal, callbacks } = options

  log("session", "runAgentSession started", { model, variant })

  if (signal?.aborted) {
    log("session", "Aborted before start")
    throw new Error("Aborted")
  }

  // 1. Create session
  log("session", "Creating session...")
  const createResult = await client.session.create()
  if (!createResult.data?.id) {
    log("session", "ERROR: Failed to create session")
    throw new Error("Failed to create session: no session ID returned")
  }
  const sessionId = createResult.data.id
  const { providerID, modelID } = parseModel(model)
  log("session", "Session created", { sessionId, providerID, modelID })

  // 2. Subscribe to events BEFORE sending prompt
  log("session", "Subscribing to events...")
  const events = await client.event.subscribe()
  log("session", "Subscribed to events, waiting for server.connected")

  let promptSent = false

  // 3. Process event stream
  for await (const event of events.stream) {
    if (signal?.aborted) {
      log("session", "Signal aborted during event loop")
      break
    }

    // 4. Send prompt when server.connected (ensures we don't miss events)
    if (event.type === "server.connected" && !promptSent) {
      promptSent = true
      log("session", "server.connected received, sending prompt", { providerID, modelID })
      
      // Fire prompt in background - don't block event loop
      client.session.prompt({
        sessionID: sessionId,
        model: { providerID, modelID },
        variant,
        parts: [{ type: "text", text: prompt }],
      }).catch((e) => {
        log("session", "Prompt error", { error: String(e) })
        callbacks.onError(e instanceof Error ? e : new Error(String(e)))
      })
      
      continue
    }

    // Tool completion events
    if (event.type === "message.part.updated") {
      const part = event.properties.part
      if (part.sessionID !== sessionId) continue

      if (part.type === "tool" && part.state.status === "completed") {
        const toolName = part.tool
        const title =
          part.state.title ||
          (Object.keys(part.state.input).length > 0
            ? JSON.stringify(part.state.input)
            : "Unknown")

        log("session", "Tool completed", { toolName, title })
        callbacks.onToolEvent({
          sessionId,
          toolName,
          title,
          timestamp: part.state.time.end,
        })
      }
    }

    // Session idle - agent finished
    if (
      event.type === "session.idle" &&
      event.properties.sessionID === sessionId
    ) {
      log("session", "session.idle received - agent finished")
      callbacks.onComplete()
      break
    }

    // Session error
    if (event.type === "session.error") {
      const props = event.properties
      if (props.sessionID !== sessionId || !props.error) continue

      let errorMessage = String(props.error.name)
      if (
        "data" in props.error &&
        props.error.data &&
        "message" in props.error.data
      ) {
        errorMessage = String(props.error.data.message)
      }

      log("session", "session.error received", { errorMessage })
      callbacks.onError(new Error(errorMessage))
      break
    }
  }

  log("session", "Event loop exited", { sessionId })
  return sessionId
}

/**
 * Poll session status until idle or timeout.
 * @param timeoutMs Timeout in milliseconds (default: 5 minutes)
 * @returns true if session became idle, false if timeout
 */
export async function waitForSessionIdle(
  client: OpencodeClient,
  sessionId: string,
  timeoutMs = 300000
): Promise<boolean> {
  const startTime = Date.now()
  const pollInterval = 2000

  while (Date.now() - startTime < timeoutMs) {
    const statusResult = await client.session.status()

    if (statusResult.data) {
      const sessionStatus = statusResult.data[sessionId]
      if (sessionStatus?.type === "idle") {
        return true
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  return false
}

/**
 * Abort a running session.
 */
export async function abortSession(
  client: OpencodeClient,
  sessionId: string
): Promise<void> {
  await client.session.abort({ sessionID: sessionId })
}
