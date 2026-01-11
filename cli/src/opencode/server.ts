import { createOpencodeServer } from "@opencode-ai/sdk"

const DEFAULT_PORT = 4190
const DEFAULT_HOSTNAME = "127.0.0.1"
const HEALTH_TIMEOUT_MS = 1000

export interface OpencodeServerOptions {
  signal?: AbortSignal
  port?: number
  hostname?: string
}

export interface OpencodeServerHandle {
  url: string
  close(): void
  attached: boolean
}

/**
 * Check if an opencode server is already running at the given URL.
 * Uses the /global/health endpoint.
 */
async function tryConnectToExistingServer(
  url: string,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const response = await fetch(`${url}/global/health`, {
      signal: signal ?? AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    if (response.ok) {
      const data = (await response.json()) as { healthy?: boolean }
      return data.healthy === true
    }
  } catch {
    // Server not running or not responding
  }
  return false
}

/**
 * Get or create an opencode server.
 * First tries to attach to an existing server, then starts a new one if needed.
 */
export async function getOrCreateOpencodeServer(
  options: OpencodeServerOptions = {}
): Promise<OpencodeServerHandle> {
  const hostname = options.hostname ?? DEFAULT_HOSTNAME
  const port = options.port ?? DEFAULT_PORT
  const url = `http://${hostname}:${port}`

  // Check for cancellation before attempting connection
  if (options.signal?.aborted) {
    throw new Error("Operation aborted")
  }

  // Try to attach to existing server first
  if (await tryConnectToExistingServer(url, options.signal)) {
    return {
      url,
      close: () => {},
      attached: true,
    }
  }

  // Check for cancellation before starting new server
  if (options.signal?.aborted) {
    throw new Error("Operation aborted")
  }

  // Start new server
  const server = await createOpencodeServer({
    port,
    hostname,
    signal: options.signal,
  })

  return {
    ...server,
    attached: false,
  }
}
