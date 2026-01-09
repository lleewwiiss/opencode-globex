import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"
import { Schema } from "effect"
import { parseModel } from "../opencode/session.js"
import { 
  InterviewRoundSchema,
  type InterviewRound,
  type InterviewPhase,
} from "../state/schema.js"
import { log } from "../util/log.js"

const MIN_QUESTIONS_TOTAL = 8
const MIN_ROUNDS = 2
const MAX_INTERVIEW_ROUNDS = 6
const MAX_PARSE_RETRIES = 2

export interface ParsedInterviewResult {
  rawText: string
  roundData: InterviewRound
  questionCount: number
  complete: boolean
}

export interface InterviewSessionResult extends ParsedInterviewResult {
  sessionId: string
}

export interface ParseContext {
  phase: InterviewPhase
  round: number
  totalQuestionsSoFar: number
}

export class InterviewParseError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = "InterviewParseError"
  }
}

function extractJson(text: string): string {
  const trimmed = text.trim()
  
  if (trimmed.startsWith("{")) {
    return trimmed
  }
  
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch?.[1]) {
    return jsonMatch[1].trim()
  }
  
  const braceStart = trimmed.indexOf("{")
  if (braceStart !== -1) {
    let depth = 0
    for (let i = braceStart; i < trimmed.length; i++) {
      if (trimmed[i] === "{") depth++
      if (trimmed[i] === "}") depth--
      if (depth === 0) {
        return trimmed.slice(braceStart, i + 1)
      }
    }
  }
  
  throw new InterviewParseError("No JSON object found in response", text)
}

export function parseInterviewResponse(
  text: string,
  ctx: ParseContext
): ParsedInterviewResult {
  const { phase, round, totalQuestionsSoFar } = ctx
  
  let jsonStr: string
  try {
    jsonStr = extractJson(text)
  } catch (e) {
    log("interview-engine", "Failed to extract JSON", { 
      textPreview: text.slice(0, 300),
      error: String(e)
    })
    throw e
  }
  
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    log("interview-engine", "Failed to parse JSON", { 
      jsonPreview: jsonStr.slice(0, 300),
      error: String(e)
    })
    throw new InterviewParseError("Invalid JSON syntax", text, e)
  }
  
  const decoded = Schema.decodeUnknownEither(InterviewRoundSchema)(parsed)
  if (decoded._tag === "Left") {
    log("interview-engine", "Schema validation failed", { 
      parsed,
      error: decoded.left
    })
    throw new InterviewParseError(
      `Schema validation failed: ${String(decoded.left)}`,
      text,
      decoded.left
    )
  }
  
  const data = decoded.right
  
  if (data.phase !== phase) {
    log("interview-engine", "Phase mismatch (non-fatal)", { 
      expected: phase, 
      got: data.phase 
    })
  }
  
  const questionCount = data.questions.length
  const newTotal = totalQuestionsSoFar + questionCount
  
  const agentWantsComplete = data.complete === true
  const hasMinQuestions = newTotal >= MIN_QUESTIONS_TOTAL
  const hasMinRounds = round >= MIN_ROUNDS
  const eligibleForCompletion = hasMinQuestions && hasMinRounds
  const maxRoundsReached = round >= MAX_INTERVIEW_ROUNDS
  
  const complete = (agentWantsComplete && eligibleForCompletion) || maxRoundsReached
  
  log("interview-engine", "Parsed interview response", {
    phase,
    round,
    questionCount,
    totalQuestionsSoFar: newTotal,
    agentWantsComplete,
    hasMinQuestions,
    hasMinRounds,
    eligibleForCompletion,
    maxRoundsReached,
    complete,
    roundTitle: data.roundTitle,
  })
  
  const roundData: InterviewRound = {
    ...data,
    complete,
  }
  
  return {
    rawText: text,
    roundData,
    questionCount,
    complete,
  }
}

export async function runInterviewSession(
  client: OpencodeClient,
  prompt: string,
  model: string,
  signal: AbortSignal,
  phase: InterviewPhase
): Promise<InterviewSessionResult> {
  const { providerID, modelID } = parseModel(model)
  
  const createResult = await client.session.create()
  if (!createResult.data?.id) {
    throw new Error("Failed to create session")
  }
  const sessionId = createResult.data.id
  
  log("interview-engine", "Session created", { sessionId, phase })
  
  const events = await client.event.subscribe()
  let promptSent = false
  let text = ""
  
  for await (const event of events.stream) {
    if (signal.aborted) break
    
    if (event.type === "server.connected" && !promptSent) {
      promptSent = true
      client.session.prompt({
        sessionID: sessionId,
        model: { providerID, modelID },
        parts: [{ type: "text", text: prompt }],
      }).catch((e) => log("interview-engine", "Prompt error", { error: String(e) }))
      continue
    }
    
    if (event.type === "message.part.updated") {
      const part = event.properties.part
      if (part.sessionID !== sessionId) continue
      if (part.type === "text" && "text" in part) {
        text = (part as { text?: string }).text || ""
      }
    }
    
    if (event.type === "session.idle" && event.properties.sessionID === sessionId) {
      break
    }
    
    if (event.type === "session.error" && event.properties.sessionID === sessionId) {
      throw new Error("Session error")
    }
  }
  
  const result = await parseWithRetry(client, sessionId, text, model, {
    phase,
    round: 1,
    totalQuestionsSoFar: 0,
  })
  
  return { sessionId, ...result }
}

export async function continueInterviewSession(
  client: OpencodeClient,
  sessionId: string,
  answer: string,
  model: string,
  signal: AbortSignal,
  ctx: ParseContext
): Promise<ParsedInterviewResult> {
  const { providerID, modelID } = parseModel(model)
  
  const events = await client.event.subscribe()
  let text = ""
  
  client.session.prompt({
    sessionID: sessionId,
    model: { providerID, modelID },
    parts: [{ type: "text", text: answer }],
  }).catch((e) => log("interview-engine", "Answer prompt error", { error: String(e) }))
  
  for await (const event of events.stream) {
    if (signal.aborted) break
    
    if (event.type === "message.part.updated") {
      const part = event.properties.part
      if (part.sessionID !== sessionId) continue
      if (part.type === "text" && "text" in part) {
        text = (part as { text?: string }).text || ""
      }
    }
    
    if (event.type === "session.idle" && event.properties.sessionID === sessionId) {
      break
    }
    
    if (event.type === "session.error" && event.properties.sessionID === sessionId) {
      throw new Error("Session error")
    }
  }
  
  return parseWithRetry(client, sessionId, text, model, ctx)
}

async function parseWithRetry(
  client: OpencodeClient,
  sessionId: string,
  initialText: string,
  model: string,
  ctx: ParseContext
): Promise<ParsedInterviewResult> {
  const { providerID, modelID } = parseModel(model)
  let text = initialText
  let attempts = 0
  let lastError: unknown
  
  while (attempts <= MAX_PARSE_RETRIES) {
    attempts++
    try {
      return parseInterviewResponse(text, ctx)
    } catch (e) {
      lastError = e
      log("interview-engine", `Parse attempt ${attempts} failed`, { 
        error: String(e),
        willRetry: attempts <= MAX_PARSE_RETRIES
      })
      
      if (attempts > MAX_PARSE_RETRIES) break
      
      const events = await client.event.subscribe()
      let retryText = ""
      
      client.session.prompt({
        sessionID: sessionId,
        model: { providerID, modelID },
        parts: [{
          type: "text",
          text: "Your previous response was not valid JSON matching the required schema. Respond again with ONLY the corrected JSON object, no markdown fences or commentary.",
        }],
      }).catch((e) => log("interview-engine", "Retry prompt error", { error: String(e) }))
      
      for await (const event of events.stream) {
        if (event.type === "message.part.updated") {
          const part = event.properties.part
          if (part.sessionID !== sessionId) continue
          if (part.type === "text" && "text" in part) {
            retryText = (part as { text?: string }).text || ""
          }
        }
        
        if (event.type === "session.idle" && event.properties.sessionID === sessionId) {
          break
        }
        
        if (event.type === "session.error" && event.properties.sessionID === sessionId) {
          throw new Error("Session error during retry")
        }
      }
      
      text = retryText
    }
  }
  
  throw new InterviewParseError(
    `Failed to parse interview response after ${MAX_PARSE_RETRIES + 1} attempts`,
    text,
    lastError
  )
}
