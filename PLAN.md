# Globex: Agentic PRD Generation with Human-in-the-Loop Validation

> "Ever see a guy say goodbye to a shoe?" - Hank Scorpio
>
> An OpenCode plugin for deterministic, high-quality PRD generation executed via Ralph loops.

## Overview

Globex combines:
- **HumanLayer's ACE-FCA**: Research → Plan → Implement with frequent intentional compaction
- **Anthropic's Long-Running Agent Harness**: Feature list (JSON, `passes: false`), progress tracking, one-task-per-loop
- **Engineering Best Practices**: DDIA, Pragmatic Programmer, Testing, Clean Architecture as evaluation frameworks

The key insight: **human leverage is highest at the spec level, lowest at implementation**. Front-load human effort into validating research and plans; execution can then run autonomously.

---

## The Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  RESEARCH (agent)                                               │
│  - Parallel sub-agents explore codebase                         │
│  - Output: research.md + research.citations.json                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  INTERVIEW: RESEARCH VALIDATION (human + agent)                 │
│  - Agent generates questions from artifact + frameworks         │
│  - Challenges BOTH human assumptions AND agent claims           │
│  - Demands evidence (file:line citations)                       │
│  - Loops until convergence OR timebox hit                       │
│  - Human: approve / approve_with_risks / reject                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PLAN (agent)                                                   │
│  - Creates phased implementation plan from approved research    │
│  - Output: plan.md + plan.risks.json                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  INTERVIEW: PLAN VALIDATION (human + agent)                     │
│  - Validates approach, sequencing, risk mitigations             │
│  - Applies framework lenses (DDIA failure modes, etc.)          │
│  - Human: approve / approve_with_risks / reject                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FEATURES (agent)                                               │
│  - Expands approved plan into atomic features                   │
│  - Output: features.json (all passes: false)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  INTERVIEW: FEATURES VALIDATION (human + agent)                 │
│  - Validates atomicity, acceptance criteria, dependencies       │
│  - Human: approve / approve_with_risks / reject                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  EXECUTE: RALPH LOOP (background, autonomous)                   │
│  - Picks ONE feature with passes=false + deps satisfied         │
│  - Implements, tests, commits                                   │
│  - Flips passes: true only after verification                   │
│  - Updates progress.md                                          │
│  - Loops until all features pass                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Decisions

### 1. Dynamic Questions from Principles, Not Hardcoded Lists

**Wrong approach:**
```
Q1: "What consistency model is used?"  // Generic, not connected to findings
Q2: "Is there duplication?"
```

**Correct approach:**
Principles are embedded in the interview skill. Agent reads actual artifact → generates specific questions applying those principles:

```
"You found a 4-step write path (API → Queue → DB → Cache). 
What happens if step 3 succeeds but step 4 fails? 
Show me where this is handled. [file:line required]"
```

The skill knows to ask about failure modes, consistency, coupling - but the questions are always **specific to actual findings**, not generic checklists.

### 2. Artifact Schemas (Oracle Recommendation)

Every artifact has both prose (`.md`) and structured data (`.json`):

**research.citations.json:**
```json
{
  "citations": [
    {
      "claim": "Auth is handled via JWT middleware",
      "path": "src/middleware/auth.ts",
      "lineStart": 45,
      "lineEnd": 67,
      "excerptHash": "a1b2c3d4",
      "confidence": "verified"
    }
  ]
}
```

**plan.risks.json:**
```json
{
  "risks": [
    {
      "description": "Cache invalidation race condition",
      "likelihood": "medium",
      "impact": "high",
      "mitigation": "Use distributed lock",
      "verification": "Load test with concurrent writes"
    }
  ]
}
```

**features.json:**
```json
{
  "features": [
    {
      "id": "F001",
      "description": "User can create new board",
      "category": "functional",
      "acceptanceCriteria": [
        "Board appears in sidebar after creation",
        "Board name is validated (1-50 chars)"
      ],
      "verification": "e2e",
      "passes": false,
      "priority": 1,
      "dependencies": [],
      "filesTouched": ["src/components/Board.tsx", "src/api/boards.ts"],
      "tests": ["e2e/board-creation.spec.ts"]
    }
  ]
}
```

### 3. Interview Engine Design

**Not inline prompts** - a reusable module that:
1. Takes: (artifact, frameworks[], phaseType)
2. Generates: specific questions referencing actual findings
3. Enforces: every challenged claim must gain a citation OR be downgraded to hypothesis
4. Tracks: convergence metrics, open issues, timebox

**Convergence rules (prevents infinite loops):**
- Stop when: no new questions from deltas, OR unresolved count stable for N turns, OR timebox hit
- Human chooses: `approve`, `approve_with_risks`, `reject`

**Timeboxes (prevents tedious interviews):**
| Phase | Default Timebox | Max Questions |
|-------|-----------------|---------------|
| Research | 20 min | 25 |
| Plan | 30 min | 30 |
| Features | 15 min | 20 |

### 4. State Machine + Persistence

**`.globex/state.json`:**
```json
{
  "currentPhase": "plan",
  "approvals": {
    "research": {
      "status": "approved_with_risks",
      "timestamp": "2026-01-06T20:00:00Z",
      "risks": ["Auth module understanding uncertain"],
      "notes": "Proceed but verify auth during implementation"
    }
  },
  "artifacts": {
    "research": ".globex/research.md",
    "researchCitations": ".globex/research.citations.json",
    "plan": ".globex/plan.md"
  },
  "interviewHistory": {
    "research": {
      "questionsAsked": 18,
      "convergenceRound": 3,
      "duration": "17m"
    }
  }
}
```

This enables:
- Resume without re-interviewing approved phases
- Diff artifacts between sessions
- Audit trail of decisions

### 5. Ralph Loop Execution

Based on Anthropic's coding agent pattern:

```
while features.some(f => !f.passes):
  1. Read progress.md + git log (get bearings)
  2. Read features.json
  3. Pick ONE feature: passes=false, highest priority, deps satisfied
  4. Implement (follow existing patterns from research)
  5. Test (e2e verification)
  6. Self-check against acceptance criteria
  7. If all pass: flip passes=true, commit, update progress.md
  8. If blocked: log issue, pick next feature
```

**Runs in background** - human walks away, comes back to completed work or clear failure.

---

## OpenCode Plugin Structure (Implemented)

```
globex/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Plugin entry: commands, agents, events, hooks
│   ├── state/
│   │   ├── types.ts                # Phase, ExecutionState, Approval types
│   │   └── persistence.ts          # .globex/ file management (Effect-based)
│   └── tools/                      # 11 custom tools
│       ├── globex-init.ts          # Initialize project
│       ├── globex-status.ts        # Get current state
│       ├── save-artifact.ts        # Save .md/.json files
│       ├── approve-phase.ts        # Record approval, transition
│       ├── verify-citation.ts      # Validate file:line references
│       ├── check-convergence.ts    # Interview convergence tracking
│       ├── update-feature.ts       # Mark feature complete/blocked
│       ├── get-next-feature.ts     # Pick next eligible feature
│       ├── update-progress.ts      # Generate progress.md
│       ├── add-learning.ts         # Write to AGENTS.md
│       └── set-phase.ts            # Manual phase override
├── skills/                          # Reference skill files
│   ├── globex-init.md
│   ├── globex-research.md
│   ├── globex-interview.md
│   ├── globex-plan.md
│   ├── globex-features.md
│   ├── globex-run.md
│   └── globex-status.md
├── scripts/
│   └── ralph-loop.sh               # External loop wrapper
├── tests/                          # 35 tests
│   ├── state.test.ts               # State persistence tests
│   └── tools.test.ts               # Tool execution tests
└── opencode.json
```

**Note:** Engineering principles (data consistency, failure modes, testability, coupling, etc.) are embedded directly into the relevant skills - no separate framework files needed.

---

## OpenCode Hooks Used (Implemented)

| Hook | Purpose |
|------|---------|
| `config` | Register 8 `/globex-*` commands and 5 subagents |
| `tool` | 11 custom tools for state management and workflow |
| `event` | session.created (auto-detect project), session.error (log to progress.md), session.idle |
| `tool.execute.after` | Toast notifications on phase approvals and feature completions |

### Commands Registered via Config Hook

| Command | Description | Subagent |
|---------|-------------|----------|
| `/globex-init` | Initialize workflow | - |
| `/globex-status` | Check current phase | - |
| `/globex-research` | Explore codebase | globex-research (read-only) |
| `/globex-interview` | Validate artifacts | globex-interview (read-only) |
| `/globex-plan` | Create implementation plan | globex-plan (read-only) |
| `/globex-features` | Generate feature list | globex-features (read-only) |
| `/globex-run` | Execute Ralph loop | globex-run (full write) |
| `/globex-help` | Show workflow help | - |

---

## Embedded Principles (in skills)

The interview and validation skills embed engineering principles directly (no separate files, no book references in code).

**Data & Consistency** (derived from "Designing Data-Intensive Applications"):
- Trace write/read paths end-to-end
- What happens on partial failure?
- What are the consistency guarantees?
- How is data replicated? What if a replica fails?
- What consistency model? Linearizable? Eventual?

**Design & Coupling** (derived from "The Pragmatic Programmer", "Clean Architecture"):
- Is knowledge duplicated? Where's the single source of truth?
- What's the blast radius of a change?
- How reversible is this decision?
- Can components be tested in isolation?
- What are the dependency directions?

**Testability** (derived from TDD/BDD best practices):
- What level of testing covers this? (unit/integration/e2e)
- How would you test this BEFORE implementing?
- What's the acceptance test a user would run?
- Is the test deterministic?

**Failure Modes:**
- What could go wrong?
- What's the fallback if X fails?
- What's the riskiest part?
- How do we detect and recover from failure?

These concepts are woven into the skills - the skills themselves don't cite books, just apply the principles.

---

## Usage

Globex is an OpenCode plugin. Commands are invoked via `/slash-commands` inside OpenCode.

### Interactive Phases (via OpenCode)

```bash
# Start OpenCode in your project
opencode

# Inside OpenCode:
> /globex-init           # Initialize new PRD workflow
> /globex-research       # Agent explores codebase
> /globex-interview      # Human validates current phase artifact
> /globex-plan           # Create implementation plan
> /globex-features       # Generate atomic feature list
> /globex-status         # Check current phase and progress
```

### Ralph Loop (External Runner)

The execution phase runs outside OpenCode via a bash loop. Each iteration starts a fresh OpenCode context, implements ONE feature, commits, and exits.

```bash
# Run the Ralph loop (from project root)
./scripts/ralph-loop.sh --max-iterations 50

# Monitor progress in another terminal
watch -n 5 'cat .globex/progress.md'
```

The loop continues until:
- Agent outputs `<promise>ALL_FEATURES_COMPLETE</promise>`
- Max iterations reached
- User presses Ctrl+C

**Why external?** OpenCode doesn't have stop hooks. External loop provides context isolation between iterations, preventing context window exhaustion and ensuring each iteration starts fresh.

---

## Human Time Investment

| Phase | Human Time | Agent Time | Saved Downstream |
|-------|-----------|------------|------------------|
| Research Interview | ~20 min | ~5 min | Hours of wrong-direction work |
| Plan Interview | ~30 min | ~10 min | Days of rework |
| Features Interview | ~15 min | ~5 min | Scope creep, missed requirements |
| Execute (Ralph) | ~0 (background) | Hours | - |
| **Total Human** | **~65 min** | - | **Potentially weeks** |

Front-load human effort into validation. Execution runs autonomously.

---

## Open Questions / Future Work

1. **Multi-repo support**: How to handle monorepos or multi-service architectures?
2. **Team collaboration**: Multiple humans reviewing same artifacts?
3. **Partial re-interview**: If only plan changes, re-interview just plan, not research?
4. **Integration with existing tools**: Jira/Linear ticket sync, PR auto-creation?
5. **Custom framework bundles**: Per-repo framework configurations?

---

## Oracle Recommendations Incorporated

1. **Artifact schemas + citations** - Structured JSON alongside prose
2. **State machine + persistence** - `.globex/state.json` for resume/replay
3. **Interview convergence rules** - Timeboxes, question limits, explicit stop conditions
4. **Citation verification** - Hash excerpts, re-validate on session resume
5. **Approve with risks** - Don't block on minor issues, track them explicitly
6. **Minimize experimental hooks** - Use `experimental.chat.system.transform` cautiously

---

## References

**Technical:**
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [HumanLayer: Advanced Context Engineering for Coding Agents](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents)
- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins/)

**Principles derived from (not cited in code/prompts):**
- Designing Data-Intensive Applications (Kleppmann) - data consistency, failure modes
- The Pragmatic Programmer (Thomas, Hunt) - DRY, orthogonality, reversibility
- Clean Architecture (Martin) - dependencies, boundaries
- TDD/BDD literature - testability, acceptance criteria
