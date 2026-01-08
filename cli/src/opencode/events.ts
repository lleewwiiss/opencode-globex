import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"

/**
 * Represents a tool execution event from the session stream.
 */
export interface ToolEvent {
  sessionId: string
  toolName: string
  title: string
  timestamp: number
}

/**
 * Callbacks for session event streaming.
 */
export interface SessionCallbacks {
  onEvent: (event: ToolEvent) => void
  onIdle: () => void
  onError: (error: Error) => void
}

export interface StreamSessionEventsOptions {
  client: OpencodeClient
  sessionId: string
  callbacks: SessionCallbacks
  signal?: AbortSignal
}

/**
 * Subscribe to session events and stream them to callbacks.
 * Parses tool completion events into ToolEvent objects.
 * Resolves when session becomes idle or signal is aborted.
 */
export async function streamSessionEvents(
  options: StreamSessionEventsOptions
): Promise<void> {
  const { client, sessionId, callbacks, signal } = options

  if (signal?.aborted) {
    return
  }

  const events = await client.event.subscribe()

  for await (const event of events.stream) {
    if (signal?.aborted) {
      break
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

        callbacks.onEvent({
          sessionId,
          toolName,
          title,
          timestamp: part.state.time.end,
        })
      }
    }

    // Session idle - iteration complete
    if (
      event.type === "session.idle" &&
      event.properties.sessionID === sessionId
    ) {
      callbacks.onIdle()
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

      callbacks.onError(new Error(errorMessage))
      break
    }
  }
}
