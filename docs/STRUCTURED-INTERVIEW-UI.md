# Structured Interview UI Design

> Comprehensive design document for improving Globex interview phases with structured JSON responses and enhanced TUI components.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Research Findings](#research-findings)
3. [Design Decisions](#design-decisions)
4. [JSON Schema Specification](#json-schema-specification)
5. [UI/UX Specification](#uiux-specification)
6. [Implementation Plan](#implementation-plan)
7. [Prompt Updates](#prompt-updates)

---

## Problem Statement

### Current Approach

The current interview phases (`research_interview` and `plan_interview`) have several issues:

#### 1. Non-Deterministic Parsing

```typescript
// Current regex-based question counting
const questionMatches = text.match(/^(?:\*\*)?\d+\./gm)
const questionCount = questionMatches?.length ?? 0
```

**Problems:**
- Relies on agent following exact markdown formatting (`1.`, `**1.`, etc.)
- Model may use bullets (`-`), parentheses (`1)`), or other formats
- Question count becomes unreliable if format varies

#### 2. Brittle Completion Detection

```typescript
const hasExplicitMarker = text.includes("INTERVIEW_COMPLETE")
```

**Problems:**
- Substring match can trigger on explanatory text ("When the interview is complete, we'll output INTERVIEW_COMPLETE")
- Model may forget to output the marker
- No enforcement of "minimum 5 questions" rule from prompt

#### 3. Limited UI/UX

Current interview screen:
- Single markdown block for all questions
- One large text area for all answers
- No per-question tracking or validation
- No visual hierarchy for question importance
- No inline context from referenced files

#### 4. Missed Opportunity

Since we're using an agent, we can:
- Parse response and request corrections if malformed
- Enforce protocol rules programmatically
- Render rich, interactive UI components
- Provide better user guidance

---

## Research Findings

### CLI/TUI Form UX Best Practices

Sources: [Lucas F. Costa CLI UX](https://lucasfcosta.com/blog/ux-patterns-cli-tools), [Evil Martians CLI Patterns](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays)

| Principle | Application |
|-----------|-------------|
| **Reduce time to value** | Show all questions upfront so user understands scope |
| **Input validation** | Validate as user types, show clear error messages |
| **Progress indicators** | Show `[2/4 answered]` and completion status |
| **Colors and visual hierarchy** | Use color for severity, status, focus states |
| **Human-understandable feedback** | Clear labels, hints, and contextual help |

### Typeform / Conversational Form Patterns

Sources: [Typeform Design Guide](https://www.typeform.com/blog/create-better-online-forms), [Fillout Form Comparison](https://www.fillout.com/blog/one-question-at-a-time-form)

| Pattern | When to Use |
|---------|-------------|
| **One question at a time** | 10+ questions, reduces overwhelm |
| **Multi-question per page** | 2-6 related questions, shows scope |
| **Progressive disclosure** | Hide advanced options until needed |
| **Answer piping** | Reference previous answers in later questions |

**Key insight**: For 2-4 questions per round (our use case), showing all questions with inline expansion works better than one-at-a-time.

### Enquirer Library Patterns

Source: [Enquirer GitHub](https://github.com/enquirer/enquirer)

**Form Prompt**: Multiple fields on one screen with navigation
```
? Please provide the following information:
  ◯ Name: _______________
  ◉ Email: john@example.com
  ◯ Password: _______________
```

**Survey Prompt**: Likert scale or rating for multiple items
```
? Please rate the following:
  ◉ Quality     ────────●── Excellent
  ◯ Speed       ──●──────── Poor
  ◯ Support     ─────●───── Good
```

**Key features:**
- Arrow key navigation between fields
- Visual indication of current focus
- Validation before submission
- Supports custom input types

### Claude Code's AskUserQuestion Tool

Source: [Claude Code Docs](https://code.claude.com/docs/en/settings), [Cyrus Article](https://www.atcyrus.com/stories/claude-code-ask-user-question-tool-guide)

**UI Features Observed:**

1. **Tab navigation for questions**
   ```
   ┌──────────┬────────────┬─────────────┬─────────┐
   │ Language │ Task Type  │ Familiarity │ Confirm │
   └──────────┴────────────┴─────────────┴─────────┘
   ```

2. **Numbered options with descriptions**
   ```
   1. TypeScript
      Node.js/Bun with TypeScript
   2. JavaScript
      Plain JavaScript
   3. Python
      Python project
   ```

3. **"Type your own answer" escape hatch**
   ```
   6. Type your own answer
      ur mom█
   ```

4. **Contextual footer**
   ```
   ⇥ tab  ↑↓ select  enter confirm  esc dismiss
   ```

**Key insight**: Always allow free-text input even when providing options. Users should never feel trapped by predefined choices.

### Progressive Disclosure

Source: [IxDF Progressive Disclosure](https://www.interaction-design.org/literature/topics/progressive-disclosure)

**Principles:**
- Show what users need when they need it
- Primary content visible, advanced content on request
- Limit layers of information (1 secondary level typically sufficient)
- Use prompts and feedback to guide discovery

**Applicable patterns:**
- Accordions for collapsed answers
- Modal/expansion for file references
- Inline hints that appear on focus

---

## Design Decisions

### Decision 1: Structured JSON Responses

**Choice**: Require agent to return structured JSON instead of free-form markdown.

**Rationale:**
- Deterministic parsing (no regex guessing)
- Enforceable protocol rules (min questions, required fields)
- Rich metadata for UI rendering (severity, references, hints)
- Agent can be asked to fix malformed responses (retry loop)

**Trade-off**: Slightly more complex prompts, but eliminates parsing fragility.

### Decision 2: Tab-Based Question Navigation

**Choice**: Display all questions in a round with tabs for navigation.

**Rationale:**
- User sees full scope upfront (reduces anxiety)
- Natural fit for 2-4 questions per round
- Can show answered/unanswered status at a glance
- Tab key doesn't conflict with text editing

**Alternative considered**: One-at-a-time (Typeform style) - rejected because our rounds are small and context between questions matters.

### Decision 3: Hybrid Input (Options + Free Text)

**Choice**: For choice questions, show predefined options AND "Type your own answer".

**Rationale:**
- Options accelerate common responses
- Free text ensures user is never blocked
- Matches Claude Code's proven pattern
- Agent can suggest options based on context

### Decision 4: Arrow Keys for Options, Tab for Navigation

**Choice**: Use arrow keys within a question (option selection), Tab/Shift+Tab between questions.

**Rationale:**
- Arrow keys conflict with multiline text editing
- Tab is standard form navigation pattern
- Clear separation: arrow=intra-question, tab=inter-question
- When editing text, all arrow keys work normally

### Decision 5: Inline File References

**Choice**: Show quoted excerpts from referenced files inline with questions.

**Rationale:**
- Context is crucial for good answers
- Reduces need to switch to editor
- Agent already provides file:line references
- Collapsible to avoid overwhelming UI

### Decision 6: Severity Indicators

**Choice**: Display `HIGH`, `MEDIUM`, `LOW` badges on questions.

**Rationale:**
- Helps user prioritize effort
- Agent can mark critical vs nice-to-have questions
- Visual hierarchy guides attention
- Can be used to require answers for HIGH severity

---

## JSON Schema Specification

### TypeScript Definitions

```typescript
// Question types
type QuestionType = "text" | "choice"

// Severity levels
type Severity = "high" | "medium" | "low"

// File reference for context
interface FileReference {
  file: string           // e.g., "research.md"
  lines?: string         // e.g., "45-60"
  quote?: string         // excerpt to display inline
}

// Option for choice questions
interface QuestionOption {
  label: string          // e.g., "Centralized store"
  description?: string   // e.g., "Single source of truth, easier debugging"
}

// Individual question
interface InterviewQuestion {
  id: string                    // stable ID, e.g., "r1-q1"
  title: string                 // short label for tabs, e.g., "Goals"
  prompt: string                // full question text (markdown supported)
  type: QuestionType            // "text" or "choice"
  required: boolean             // must answer before submitting round
  severity: Severity            // visual priority indicator
  reference?: FileReference     // optional context from artifact
  options?: QuestionOption[]    // for choice type (always include "other")
  hint?: string                 // placeholder text for input
  default?: string              // suggested answer (agent's recommendation)
}

// Agent response for a round
interface InterviewRound {
  phase: "research_interview" | "plan_interview"
  round: number                 // 1-indexed
  roundTitle: string            // e.g., "Round 1: Architecture"
  questions: InterviewQuestion[]
  totalQuestionsAskedSoFar: number
  complete: boolean             // agent's signal that interview is done
  completionReason?: string     // why complete (for logging)
}

// User response payload
interface InterviewAnswer {
  questionId: string
  answer: string                // text answer or selected option label
  isCustom?: boolean            // true if user typed instead of selecting option
}

interface InterviewAnswerPayload {
  phase: "research_interview" | "plan_interview"
  round: number
  answers: InterviewAnswer[]
}
```

### Effect Schema Definitions

```typescript
import { Schema } from "effect"

export const SeveritySchema = Schema.Union(
  Schema.Literal("high"),
  Schema.Literal("medium"),
  Schema.Literal("low")
)
export type Severity = Schema.Schema.Type<typeof SeveritySchema>

export const QuestionTypeSchema = Schema.Union(
  Schema.Literal("text"),
  Schema.Literal("choice")
)
export type QuestionType = Schema.Schema.Type<typeof QuestionTypeSchema>

export const FileReferenceSchema = Schema.Struct({
  file: Schema.String,
  lines: Schema.optional(Schema.String),
  quote: Schema.optional(Schema.String),
})
export type FileReference = Schema.Schema.Type<typeof FileReferenceSchema>

export const QuestionOptionSchema = Schema.Struct({
  label: Schema.String,
  description: Schema.optional(Schema.String),
})
export type QuestionOption = Schema.Schema.Type<typeof QuestionOptionSchema>

export const InterviewQuestionSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  prompt: Schema.String,
  type: QuestionTypeSchema,
  required: Schema.Boolean,
  severity: SeveritySchema,
  reference: Schema.optional(FileReferenceSchema),
  options: Schema.optional(Schema.Array(QuestionOptionSchema)),
  hint: Schema.optional(Schema.String),
  default: Schema.optional(Schema.String),
})
export type InterviewQuestion = Schema.Schema.Type<typeof InterviewQuestionSchema>

export const InterviewRoundSchema = Schema.Struct({
  phase: Schema.Union(
    Schema.Literal("research_interview"),
    Schema.Literal("plan_interview")
  ),
  round: Schema.Number,
  roundTitle: Schema.String,
  questions: Schema.Array(InterviewQuestionSchema),
  totalQuestionsAskedSoFar: Schema.Number,
  complete: Schema.Boolean,
  completionReason: Schema.optional(Schema.String),
})
export type InterviewRound = Schema.Schema.Type<typeof InterviewRoundSchema>

export const InterviewAnswerSchema = Schema.Struct({
  questionId: Schema.String,
  answer: Schema.String,
  isCustom: Schema.optional(Schema.Boolean),
})
export type InterviewAnswer = Schema.Schema.Type<typeof InterviewAnswerSchema>

export const InterviewAnswerPayloadSchema = Schema.Struct({
  phase: Schema.Union(
    Schema.Literal("research_interview"),
    Schema.Literal("plan_interview")
  ),
  round: Schema.Number,
  answers: Schema.Array(InterviewAnswerSchema),
})
export type InterviewAnswerPayload = Schema.Schema.Type<typeof InterviewAnswerPayloadSchema>
```

### Example JSON (Agent → TUI)

```json
{
  "phase": "research_interview",
  "round": 1,
  "roundTitle": "Round 1: Goals & Architecture",
  "questions": [
    {
      "id": "r1-q1",
      "title": "Goals",
      "prompt": "**What is the main outcome this work should achieve?**\n\nDescribe the core goal in 2-4 sentences.",
      "type": "text",
      "required": true,
      "severity": "high",
      "reference": {
        "file": "research.md",
        "lines": "15-25",
        "quote": "The system should handle concurrent edits from multiple users..."
      },
      "hint": "Describe the primary outcome..."
    },
    {
      "id": "r1-q2",
      "title": "Architecture",
      "prompt": "**Does the architecture described in research.md match your mental model?**",
      "type": "choice",
      "required": true,
      "severity": "high",
      "reference": {
        "file": "research.md",
        "lines": "80-115"
      },
      "options": [
        {
          "label": "Yes, it matches",
          "description": "The documented architecture is accurate"
        },
        {
          "label": "Partially",
          "description": "Some aspects are correct, but there are gaps"
        },
        {
          "label": "No, it's different",
          "description": "The actual architecture differs significantly"
        }
      ]
    },
    {
      "id": "r1-q3",
      "title": "Edge Cases",
      "prompt": "**Are there any edge cases missing from the research?**",
      "type": "text",
      "required": false,
      "severity": "medium",
      "hint": "Describe any edge cases you're aware of..."
    }
  ],
  "totalQuestionsAskedSoFar": 3,
  "complete": false
}
```

### Example JSON (TUI → Agent)

```json
{
  "phase": "research_interview",
  "round": 1,
  "answers": [
    {
      "questionId": "r1-q1",
      "answer": "The main goal is to enable real-time collaboration between multiple users editing the same document, with conflict resolution that preserves user intent."
    },
    {
      "questionId": "r1-q2",
      "answer": "Partially",
      "isCustom": false
    },
    {
      "questionId": "r1-q3",
      "answer": "What happens when a user goes offline mid-edit and comes back online with stale state?"
    }
  ]
}
```

---

## UI/UX Specification

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  Research Interview • Round 1                           00:03:42   │ <- Header
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────┬────────────────┬──────────────┐                     │ <- Tabs
│  │ ❯ Goals ✓ │  Architecture  │  Edge Cases  │                     │
│  └───────────┴────────────────┴──────────────┘                     │
│                                                                     │
│  Goals                                                       HIGH   │ <- Question Header
│  ─────────────────────────────────────────────────────────────────  │
│  What is the main outcome this work should achieve?                 │ <- Question Prompt
│                                                                     │
│  ▸ research.md:15-25                                                │ <- Reference (collapsible)
│    "The system should handle concurrent edits..."                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │ <- Answer Input
│  │ The main goal is to enable real-time collaboration         │    │
│  │ between multiple users editing the same document,          │    │
│  │ with conflict resolution that preserves user intent._      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ⇥ tab: next  •  ⇧⇥: prev  •  ↵: submit round  •  esc: quit       │ <- Footer
└─────────────────────────────────────────────────────────────────────┘
```

### For Choice Questions

```
│  Architecture                                                HIGH   │
│  ─────────────────────────────────────────────────────────────────  │
│  Does the architecture described in research.md match your         │
│  mental model?                                                      │
│                                                                     │
│  ▸ research.md:80-115                                               │
│                                                                     │
│    1. Yes, it matches                                               │
│       The documented architecture is accurate                       │
│  ❯ 2. Partially                                                     │
│       Some aspects are correct, but there are gaps                  │
│    3. No, it's different                                            │
│       The actual architecture differs significantly                 │
│    4. Type your own answer                                          │
│       ┌─────────────────────────────────────────────────────────┐   │
│       │ _                                                       │   │
│       └─────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ↑↓: select option  •  ⇥: next question  •  ↵: confirm            │
```

### Component Hierarchy

```
InterviewScreen
├── SimpleHeader (phase, project, elapsed time)
├── QuestionTabs
│   └── Tab[] (title, answered status, active state)
├── QuestionPanel
│   ├── QuestionHeader (title, severity badge)
│   ├── QuestionPrompt (markdown text)
│   ├── FileReference (collapsible quote)
│   └── AnswerInput
│       ├── TextInput (for type: "text")
│       └── ChoiceInput (for type: "choice")
│           ├── OptionList
│           │   └── Option[] (label, description, selected)
│           └── CustomTextInput ("Type your own answer")
└── SimpleFooter (contextual keybinds, stats)
```

### State Management

```typescript
interface InterviewScreenState {
  // From agent
  currentRound: InterviewRound | null
  
  // UI state
  activeQuestionIndex: number        // which tab is selected
  answers: Map<string, string>       // questionId -> answer
  customInputActive: boolean         // for choice questions, is user typing?
  selectedOptionIndex: number        // for choice questions
  
  // Status
  isWaitingForAgent: boolean
  isSubmitting: boolean
}
```

### Keyboard Interactions

| Context | Key | Action |
|---------|-----|--------|
| Any | `Tab` | Move to next question |
| Any | `Shift+Tab` | Move to previous question |
| Any | `Esc` | Quit interview |
| Text input | Arrow keys | Navigate within text |
| Text input | `Ctrl+Enter` | Submit round |
| Choice question | `↑` / `↓` | Select option |
| Choice question | `Enter` | Confirm option selection |
| Choice question | Start typing | Activate "Type your own" |
| "Type your own" | `Esc` | Cancel, return to options |

### Visual States

| Element | State | Visual |
|---------|-------|--------|
| Tab | Unanswered | Default color |
| Tab | Answered | ✓ suffix, muted color |
| Tab | Active | Highlighted background, bold |
| Tab | Required unanswered | Warning color |
| Severity | HIGH | Red/orange badge |
| Severity | MEDIUM | Yellow badge |
| Severity | LOW | Gray badge |
| Option | Unselected | `○` prefix |
| Option | Selected | `●` prefix, highlighted |
| Reference | Collapsed | `▸` prefix |
| Reference | Expanded | `▾` prefix, quote visible |

### Colors (using existing palette)

```typescript
// From cli/src/components/colors.ts
const interviewColors = {
  tabActive: colors.cyan,
  tabAnswered: colors.green,
  tabUnanswered: colors.fgDark,
  severityHigh: colors.red,
  severityMedium: colors.yellow,
  severityLow: colors.fgDark,
  reference: colors.blue,
  optionSelected: colors.cyan,
  optionUnselected: colors.fg,
  inputBorder: colors.border,
  inputBorderFocused: colors.cyan,
}
```

---

## Implementation Plan

### Phase 1: Schema & Types (Small)

1. Add Effect Schema definitions to `cli/src/state/schema.ts`
2. Export TypeScript types for use in components
3. Add validation functions

**Files:**
- `cli/src/state/schema.ts` (extend)

### Phase 2: Prompt Updates (Small)

1. Update `INTERVIEW_PROMPT` to require JSON output
2. Update `PLAN_INTERVIEW_PROMPT` similarly
3. Add JSON schema documentation to prompts
4. Remove `INTERVIEW_COMPLETE` marker instructions

**Files:**
- `cli/src/agents/prompts.ts` (modify)

### Phase 3: Parser Updates (Small)

1. Replace regex-based `parseResult` with JSON parsing
2. Add validation using Effect Schema
3. Add retry logic for malformed responses
4. Enforce minimum questions rule

**Files:**
- `cli/src/phases/research-interview.ts` (modify)
- `cli/src/phases/plan-interview.ts` (modify)

### Phase 4: Interview Components (Medium)

1. Create `QuestionTabs` component
2. Create `QuestionPanel` component
3. Create `ChoiceInput` component with options + custom text
4. Create `FileReference` collapsible component
5. Update `InterviewScreen` to use new components

**Files:**
- `cli/src/components/screens/interview.tsx` (major refactor)
- `cli/src/components/question-tabs.tsx` (new)
- `cli/src/components/question-panel.tsx` (new)
- `cli/src/components/choice-input.tsx` (new)
- `cli/src/components/file-reference.tsx` (new)

### Phase 5: State & Integration (Medium)

1. Extend `InterviewState` in `app.tsx`
2. Wire up structured answers to agent
3. Handle round transitions
4. Test end-to-end flow

**Files:**
- `cli/src/app.tsx` (modify)
- `cli/src/phases/research-interview.ts` (modify)
- `cli/src/phases/plan-interview.ts` (modify)

### Phase 6: Polish (Small)

1. Add keyboard shortcut help overlay
2. Add answer validation for required questions
3. Add loading states and error handling
4. Write tests for parser and components

---

## Prompt Updates

### Research Interview Prompt (Updated Output Section)

```markdown
## Output Format

You MUST respond ONLY with a single JSON object. No markdown fences, no commentary before or after.

### JSON Schema

{
  "phase": "research_interview",
  "round": <number>,                    // starts at 1, increments each round
  "roundTitle": "<string>",             // e.g., "Round 1: Architecture & Goals"
  "questions": [
    {
      "id": "<string>",                 // format: "r{round}-q{n}", e.g., "r1-q1"
      "title": "<string>",              // short label for tab display (2-3 words)
      "prompt": "<string>",             // full question text (markdown supported)
      "type": "text" | "choice",        // choice includes "type your own" option
      "required": <boolean>,            // must be answered before round submission
      "severity": "high" | "medium" | "low",
      "reference": {                    // optional - include when citing artifact
        "file": "<string>",             // e.g., "research.md"
        "lines": "<string>",            // e.g., "45-60"
        "quote": "<string>"             // short excerpt for inline display
      },
      "options": [                      // only for type: "choice"
        {
          "label": "<string>",
          "description": "<string>"     // optional clarification
        }
      ],
      "hint": "<string>",               // optional placeholder text
      "default": "<string>"             // optional suggested answer
    }
  ],
  "totalQuestionsAskedSoFar": <number>, // running count across all rounds
  "complete": <boolean>,                // true ONLY when convergence reached
  "completionReason": "<string>"        // brief explanation when complete
}

### Rules

- Ask 2-4 questions per round
- Use "choice" type when there are clear predefined answers
- Use "text" type for open-ended questions (most common)
- Mark questions as "high" severity if they block understanding
- Include file references when citing specific parts of artifacts
- Set complete: true only after minimum 5 questions AND no new gaps for 2 rounds
- Do NOT include literal "INTERVIEW_COMPLETE" text anywhere

### Input Format

You will receive user answers as JSON:

{
  "phase": "research_interview",
  "round": <number>,
  "answers": [
    {
      "questionId": "<string>",
      "answer": "<string>",
      "isCustom": <boolean>            // true if user typed instead of selecting option
    }
  ]
}
```

### Plan Interview Prompt (Similar Updates)

Same structure as research interview, but with `"phase": "plan_interview"` and focus on plan validation.

---

## Appendix: Research Sources

### CLI/TUI UX
- [UX patterns for CLI tools - Lucas F. Costa](https://lucasfcosta.com/blog/ux-patterns-cli-tools)
- [CLI UX best practices - Evil Martians](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays)

### Form Design
- [One-question-at-a-time vs single-page forms - Fillout](https://www.fillout.com/blog/one-question-at-a-time-form)
- [Create forms that click - Typeform](https://www.typeform.com/blog/create-better-online-forms)
- [Conversational Form Design - Formidable Forms](https://formidableforms.com/conversational-form-design/)

### Progressive Disclosure
- [Progressive Disclosure - IxDF](https://www.interaction-design.org/literature/topics/progressive-disclosure)

### CLI Libraries
- [Enquirer - GitHub](https://github.com/enquirer/enquirer)
- [Ink - React for CLI](https://github.com/vadimdemedes/ink)

### Claude Code
- [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Claude Code Settings Docs](https://code.claude.com/docs/en/settings)
- [AskUserQuestion Tool Guide - Cyrus](https://www.atcyrus.com/stories/claude-code-ask-user-question-tool-guide)
- [Claude Code Terminal UI - Reddit Discussion](https://www.reddit.com/r/ClaudeAI/comments/1m8a4ci/kudos_to_whoever_designed_the_terminal_interface/)
