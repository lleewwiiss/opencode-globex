import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"

export interface SpawnSessionResult {
  sessionId: string
}

/**
 * Parse model string into provider/model parts.
 * @param model Format: "provider/model" (e.g., "anthropic/claude-opus-4")
 */
function parseModel(model: string): { providerID: string; modelID: string } {
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
 * Create a new session with an agent and initial prompt.
 * @returns The session ID
 */
export async function spawnAgentSession(
  client: OpencodeClient,
  agent: string,
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
    agent,
    model: { providerID, modelID },
    parts: [{ type: "text", text: prompt }],
  })

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
