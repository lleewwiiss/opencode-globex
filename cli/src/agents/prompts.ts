import { readFileSync } from "node:fs"

const promptDir = new URL("./prompts/", import.meta.url)

const readPrompt = (name: string): string =>
  readFileSync(new URL(name, promptDir), "utf-8")

export const RESEARCH_PROMPT = readPrompt("research.md")
export const INTERVIEW_PROMPT = readPrompt("interview.md")
export const PLAN_PROMPT = readPrompt("plan.md")
export const PLAN_INTERVIEW_PROMPT = readPrompt("plan-interview.md")
export const FEATURES_PROMPT = readPrompt("features.md")
export const RALPH_PROMPT = readPrompt("ralph.md")
export const WIGGUM_PROMPT = readPrompt("wiggum.md")
