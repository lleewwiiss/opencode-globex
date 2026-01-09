# Globex TUI Flow Architecture

> Documentation of the full CLI/TUI flow with multiple OpenCode clients and user interactions.

## Overview

The Globex CLI uses a multi-phase workflow where different OpenCode clients handle different responsibilities:

- **Background Clients**: Run autonomously (research, planning, feature generation)
- **Interview Clients**: Bidirectional conversation with user
- **Loop Clients**: Ralph/Wiggum execution loop

The TUI adapts its display based on the current phase, showing appropriate screens for each stage.

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              START CLI                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  INIT SCREEN                                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│  TUI: InitScreen                                                             │
│  User Input: Select (continue/new) + Text input (description)               │
│  Client: None (pre-client)                                                   │
│                                                                              │
│  Options:                                                                    │
│  • Continue active project → Jump to current phase screen                   │
│  • Start new project → Enter description → Begin research                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ New Project                   │ Continue
                    ▼                               ▼
┌───────────────────────────────────┐   ┌─────────────────────────────────────┐
│  RESEARCH PHASE                   │   │  RESUME AT CURRENT PHASE            │
│  ─────────────────────────────    │   │  (jump to appropriate screen)       │
│  TUI: BackgroundScreen            │   └─────────────────────────────────────┘
│  Client: Background (autonomous)  │
│  Display: Spinner + "Researching  │
│           codebase..."            │
│  Output: research.md              │
└───────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RESEARCH INTERVIEW PHASE                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  TUI: InterviewScreen                                                        │
│  Client: Interview (bidirectional)                                           │
│  User Input: Text answers to agent questions                                 │
│                                                                              │
│  Flow:                                                                       │
│  1. Agent reads research.md, generates questions                            │
│  2. Questions displayed in TUI                                               │
│  3. User types answer in <input>                                            │
│  4. Answer sent to session                                                   │
│  5. Repeat until convergence (2-3 rounds no new gaps)                       │
│  6. Agent updates research.md with clarifications                           │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────┐
│  PLAN PHASE                       │
│  ─────────────────────────────    │
│  TUI: BackgroundScreen            │
│  Client: Background (autonomous)  │
│  Display: Spinner + "Creating     │
│           implementation plan..." │
│  Output: plan.md, plan-risks.json │
└───────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLAN INTERVIEW PHASE                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  TUI: InterviewScreen                                                        │
│  Client: Interview (bidirectional)                                           │
│  User Input: Text answers validating plan approach                          │
│                                                                              │
│  Same flow as research interview, but focused on:                           │
│  • Implementation approach                                                   │
│  • Risk mitigations                                                          │
│  • Sequencing decisions                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────┐
│  FEATURES PHASE                   │
│  ─────────────────────────────    │
│  TUI: BackgroundScreen            │
│  Client: Background (autonomous)  │
│  Display: Spinner + "Generating   │
│           feature list..."        │
│  Output: features.json            │
└───────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LOOP CONFIRM SCREEN                                                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  TUI: ConfirmScreen                                                          │
│  User Input: Confirm to start execution                                      │
│                                                                              │
│  Display:                                                                    │
│  • Feature count summary                                                     │
│  • Estimated time                                                            │
│  • "Press Enter to start Ralph loop"                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXECUTE PHASE (RALPH LOOP)                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  TUI: ExecuteScreen (current implementation)                                 │
│  Client: Loop (Ralph + Wiggum alternating)                                   │
│  User Input: Pause/Resume/Quit only                                          │
│                                                                              │
│  Display:                                                                    │
│  • Header: phase, project, progress                                          │
│  • Log: tool events, iteration markers                                       │
│  • Footer: keybinds, commits, elapsed time                                   │
│                                                                              │
│  Loop:                                                                       │
│  1. Ralph implements ONE feature                                             │
│  2. Wiggum validates                                                         │
│  3. If approved → commit, mark passes:true                                  │
│  4. If rejected → retry with feedback                                        │
│  5. Repeat until all features pass                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────┐
│  COMPLETE                         │
│  ─────────────────────────────    │
│  TUI: CompleteScreen              │
│  Display: Summary of work done    │
└───────────────────────────────────┘
```

---

## TUI Screens

### 1. InitScreen (This Implementation)

**Purpose**: First screen when CLI starts. Choose to continue or start new project.

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│ ◐ globex · init                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                         ╭──────────────────╮                    │
│                         │   ◈  GLOBEX      │                    │
│                         ╰──────────────────╯                    │
│                                                                 │
│   What would you like to do?                                    │
│                                                                 │
│   ▸ Continue "my-feature" (research_interview)                  │
│     Start a new project                                         │
│                                                                 │
│   ─────────────────────────────────────────                     │
│                                                                 │
│   Describe your project:                                        │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Add authentication using JWT tokens...                  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ (↑↓) navigate  (enter) select  (q) quit                         │
└─────────────────────────────────────────────────────────────────┘
```

**Components**:
- `InitHeader`: Simplified header showing "globex · init"
- `Logo`: Styled GLOBEX branding
- `ProjectSelect`: `<select>` for continue/new choice (only if active project exists)
- `DescriptionInput`: `<input>` for project description
- `InitFooter`: Navigation keybind hints

**State Machine**:
```typescript
type InitStep = "select" | "input"
// "select" - choosing between continue/new (only if activeProject exists)
// "input" - entering project description
```

**Callbacks**:
- `onContinue(projectId: string)`: User chose to continue existing project
- `onNewProject(description: string)`: User submitted new project description

---

### 2. BackgroundScreen (Future)

**Purpose**: Display progress while background agent works autonomously.

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│ ◐ my-project · research                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ⠋ Researching codebase...                    │
│                                                                 │
│   Exploring project structure                                   │
│   Analyzing dependencies                                        │
│   Identifying patterns                                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ (q) cancel                                          00:42       │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. InterviewScreen (Redesigned)

**Purpose**: Bidirectional Q&A between agent and user with structured JSON responses.

> **See [STRUCTURED-INTERVIEW-UI.md](./STRUCTURED-INTERVIEW-UI.md) for comprehensive design documentation.**

**Key Design Changes:**
- Agent returns structured JSON instead of free-form markdown
- Tab-based navigation between questions in a round
- Per-question inputs with choice options and free-text
- Inline file references with collapsible quotes
- Severity indicators (HIGH/MEDIUM/LOW)

**Layout (Text Question)**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Research Interview • Round 1                       00:03:42    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────┬────────────────┬──────────────┐                  │
│  │ ❯ Goals ✓ │  Architecture  │  Edge Cases  │                  │
│  └───────────┴────────────────┴──────────────┘                  │
│                                                                 │
│  Goals                                                   HIGH   │
│  ─────────────────────────────────────────────────────────────  │
│  What is the main outcome this work should achieve?             │
│                                                                 │
│  ▸ research.md:15-25                                            │
│    "The system should handle concurrent edits..."               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Enable real-time collaboration between users editing    │    │
│  │ the same document with conflict resolution._            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ⇥ tab: next  •  ⇧⇥: prev  •  ↵: submit round  •  esc: quit   │
└─────────────────────────────────────────────────────────────────┘
```

**Layout (Choice Question)**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Research Interview • Round 1                       00:04:15    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────┬──────────────────┬──────────────┐                │
│  │  Goals ✓  │ ❯ Architecture   │  Edge Cases  │                │
│  └───────────┴──────────────────┴──────────────┘                │
│                                                                 │
│  Architecture                                            HIGH   │
│  ─────────────────────────────────────────────────────────────  │
│  Does the architecture in research.md match your mental model?  │
│                                                                 │
│    1. Yes, it matches                                           │
│       The documented architecture is accurate                   │
│  ❯ 2. Partially                                                 │
│       Some aspects are correct, but there are gaps              │
│    3. No, it's different                                        │
│       The actual architecture differs significantly             │
│    4. Type your own answer                                      │
│       ┌─────────────────────────────────────────────────────┐   │
│       │ _                                                   │   │
│       └─────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ↑↓: select option  •  ⇥: next question  •  ↵: confirm         │
└─────────────────────────────────────────────────────────────────┘
```

**Keyboard Navigation:**
| Context | Key | Action |
|---------|-----|--------|
| Any | `Tab` | Next question |
| Any | `Shift+Tab` | Previous question |
| Text input | Arrow keys | Navigate within text |
| Choice question | `↑` / `↓` | Select option |
| Choice question | Start typing | Activate custom input |

---

### 4. ExecuteScreen (Current Implementation)

The existing `app.tsx` implementation with Header, Log, Footer, and PausedOverlay.

---

## OpenCode Client Types

### Background Client

**Purpose**: Autonomous work (research, plan, features generation)

**Characteristics**:
- Fire-and-forget prompt
- Subscribe to events for progress display
- Wait for `session.idle` to know completion
- No user input during execution

**Usage**:
```typescript
const sessionId = await spawnAgentSession(client, "globex-research", RESEARCH_PROMPT, model)
await streamSessionEvents({ client, sessionId, callbacks, signal })
```

### Interview Client

**Purpose**: Interactive Q&A with user using structured JSON protocol

**Characteristics**:
- Agent returns structured JSON with questions, options, and metadata
- TUI renders rich form UI with tabs, choices, and text inputs
- User answers sent back as structured JSON payload
- Multiple rounds until convergence (agent sets `complete: true`)
- Session stays active across Q&A exchanges
- Malformed JSON triggers retry with correction request

**Key Difference**: Unlike background clients, interview sessions use structured JSON for deterministic parsing:

```typescript
// Initial prompt starts interview (agent returns JSON)
const sessionId = await spawnAgentSession(client, "globex-interview", INTERVIEW_PROMPT, model)

// Subscribe to events to capture agent response
for await (const event of events.stream) {
  if (event.type === "message.part.updated" && part.type === "text") {
    // Parse structured JSON response
    const round = parseInterviewRound(part.content)
    if (round.success) {
      // Display questions in TUI with tabs, options, references
      displayRound(round.data)
    } else {
      // Ask agent to fix malformed response
      await retryWithCorrection(sessionId, round.error)
    }
  }
  if (event.type === "session.idle") {
    // Agent finished, wait for user to complete all questions
    const answers = await collectUserAnswers()
    
    // Send structured answer payload back
    await client.session.prompt({
      sessionID: sessionId,
      parts: [{ type: "text", text: JSON.stringify(answers) }],
    })
  }
}
```

**JSON Protocol**: See [STRUCTURED-INTERVIEW-UI.md](./STRUCTURED-INTERVIEW-UI.md) for complete schema.

### Loop Client

**Purpose**: Ralph/Wiggum execution loop

**Characteristics**:
- Similar to reference repo's implementation
- Each iteration is a fresh session
- Marker files signal completion (.globex-done, .globex-approved, .globex-rejected)
- No direct user input, only pause/resume via file or keybind

---

## State Management

### Screen State

```typescript
type Screen = 
  | "init"           // InitScreen - project selection
  | "background"     // BackgroundScreen - autonomous work
  | "interview"      // InterviewScreen - Q&A
  | "confirm"        // ConfirmScreen - pre-loop confirmation
  | "execute"        // ExecuteScreen - ralph loop

interface AppState {
  screen: Screen
  phase: Phase
  projectId?: string
  projectName?: string
  // ... screen-specific state
}
```

### Phase to Screen Mapping

| Phase | Primary Screen | Notes |
|-------|---------------|-------|
| `init` | InitScreen | Always starts here if no project |
| `research` | BackgroundScreen | Autonomous research |
| `research_interview` | InterviewScreen | Q&A about research |
| `plan` | BackgroundScreen | Autonomous planning |
| `plan_interview` | InterviewScreen | Q&A about plan |
| `features` | BackgroundScreen | Autonomous feature generation |
| `execute` | ExecuteScreen | Ralph loop |
| `complete` | CompleteScreen | Summary |

---

## File Structure

```
cli/src/
├── components/
│   ├── screens/
│   │   ├── init.tsx           # InitScreen (this implementation)
│   │   ├── background.tsx     # BackgroundScreen (future)
│   │   ├── interview.tsx      # InterviewScreen (future)
│   │   └── execute.tsx        # Refactored from current app.tsx (future)
│   ├── init-header.tsx        # Simplified header for init screen
│   ├── init-footer.tsx        # Navigation hints footer
│   ├── header.tsx             # Existing execute header
│   ├── footer.tsx             # Existing execute footer
│   ├── log.tsx                # Existing event log
│   ├── paused.tsx             # Existing pause overlay
│   └── colors.ts              # Shared color palette
├── app.tsx                    # Screen router/state machine
├── index.ts                   # Entry point
└── ...
```

---

## Implementation Order

### Phase 1: InitScreen (Current)
1. Create `docs/TUI-FLOW.md` (this file)
2. Create `cli/src/components/screens/init.tsx`
3. Create `cli/src/components/init-header.tsx`
4. Create `cli/src/components/init-footer.tsx`
5. Modify `cli/src/app.tsx` to support screen switching
6. Modify `cli/src/index.ts` to start with init screen

### Phase 2: BackgroundScreen (Future)
- Spinner animation
- Status messages
- Progress indicators

### Phase 3: InterviewScreen (Future)
- Agent message display
- User text input
- Round/timebox tracking
- Convergence detection

### Phase 4: Integration (Future)
- Wire up phase transitions
- Connect OpenCode clients to screens
- Full end-to-end flow

---

## Technical Notes

### OpenTUI Components Used

| Component | JSX Element | Purpose |
|-----------|-------------|---------|
| Box | `<box>` | Layout container |
| Text | `<text>` | Text display with colors |
| Input | `<input>` | Text input field |
| Select | `<select>` | Option selection |
| ScrollBox | `<scrollbox>` | Scrollable container |

### Input Component Props (from @opentui/solid)

```typescript
interface InputProps {
  placeholder?: string
  value?: string
  focused?: boolean
  onInput?: (value: string) => void   // fires on each keystroke
  onChange?: (value: string) => void  // fires when committed
  onSubmit?: (value: string) => void  // fires on Enter
  // + styling options
}
```

### Select Component Props

```typescript
interface SelectProps {
  options: SelectOption[]
  focused?: boolean
  onChange?: (index: number, option: SelectOption | null) => void
  onSelect?: (index: number, option: SelectOption | null) => void
}

interface SelectOption {
  name: string
  description?: string
  value?: string
}
```

### Focus Management

Only one element can be focused at a time. Use signals to track focus:

```typescript
const [focusedElement, setFocusedElement] = createSignal<"select" | "input">("select")

<select focused={focusedElement() === "select"} ... />
<input focused={focusedElement() === "input"} ... />
```
