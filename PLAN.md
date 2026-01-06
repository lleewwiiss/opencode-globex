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

## OpenCode Plugin Structure

```
globex/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Plugin entry point
│   ├── state/
│   │   ├── machine.ts              # Phase state machine
│   │   └── persistence.ts          # .globex/ file management
│   ├── phases/
│   │   ├── research.ts             # Research phase orchestration
│   │   ├── plan.ts                 # Planning phase
│   │   ├── features.ts             # Feature list generation
│   │   └── execute.ts              # Ralph loop runner
│   ├── interview/
│   │   ├── engine.ts               # Question generation + convergence
│   │   ├── citations.ts            # Evidence verification
│   │   └── runner.ts               # Interview orchestration
│   ├── tools/
│   │   ├── save-artifact.ts        # Save phase artifacts
│   │   ├── verify-citation.ts      # Check file:line still valid
│   │   ├── check-convergence.ts    # Interview convergence check
│   │   └── approve-phase.ts        # Human approval gate
│   └── lib/
│       └── effect-utils.ts         # Effect runtime utilities
├── skills/                          # Skills with embedded principles
│   ├── globex-init.md              # Initialize new PRD
│   ├── globex-research.md          # Research phase (principles embedded)
│   ├── globex-interview.md         # Validation interview (principles embedded)
│   ├── globex-plan.md              # Planning phase (principles embedded)
│   ├── globex-features.md          # Generate features
│   └── globex-run.md               # Execute Ralph loop
└── tests/
```

**Note:** Engineering principles (data consistency, failure modes, testability, coupling, etc.) are embedded directly into the relevant skills - no separate framework files needed.

---

## OpenCode Hooks Used

| Hook | Purpose |
|------|---------|
| `config` | Register `/globex-*` commands |
| `tool` | Custom tools (save_artifact, verify_citation, approve_phase) |
| `event` | Track session.created, session.idle for notifications |
| `experimental.chat.system.transform` | Inject current phase context (use cautiously) |

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

## CLI Commands

```bash
# Initialize new PRD workflow
globex init "feature description"

# Run research phase
globex research

# Conduct validation interview for current phase
globex interview

# Run planning phase (requires approved research)
globex plan

# Generate features (requires approved plan)
globex features

# Execute Ralph loop in background
globex run --background

# Check progress
globex status

# View logs
globex logs -f

# Pause/resume execution
globex pause
globex resume
```

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
