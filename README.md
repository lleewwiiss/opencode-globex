# Globex

Agentic PRD generation with human-in-the-loop validation. An [OpenCode](https://opencode.ai) plugin.

Named after Hank Scorpio's company. The "Ralph loop" is named after Ralph Wiggum.

## Philosophy

Human leverage is highest at spec level, lowest at implementation. Front-load human validation into research and planning; execution runs autonomously.

Based on:
- [Anthropic's Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Geoffrey Huntley's Ralph Driven Development](https://ghuntley.com/ralph/)
- [Anthropic's Ralph Wiggum Plugin](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum)

## Flow

```
/globex-init → /globex-research → /globex-interview → /globex-plan → /globex-interview → /globex-features → /globex-interview → /globex-run
```

Each phase requires human approval via `/globex-interview` before proceeding.

## Installation

```bash
# Clone the repo
git clone https://github.com/yourorg/globex.git
cd globex

# Install dependencies
bun install

# Build
bun run build

# Link to OpenCode (adjust path as needed)
# Add to your opencode config or symlink to plugins directory
```

## Usage

### 1. Initialize Project

```bash
opencode
> /globex-init
```

Creates `.globex/` directory with state tracking.

### 2. Research Phase

```bash
> /globex-research
```

Agent explores codebase, documents AS-IS state with citations.

### 3. Validate Research

```bash
> /globex-interview
```

Human reviews research, asks clarifying questions, approves or requests changes.

### 4. Plan Phase

```bash
> /globex-plan
```

Agent creates implementation plan from research findings.

### 5. Validate Plan

```bash
> /globex-interview
```

Human reviews plan, resolves open questions, approves.

### 6. Generate Features

```bash
> /globex-features
```

Agent breaks plan into atomic, implementable features sized for ~50% context window.

### 7. Validate Features

```bash
> /globex-interview
```

Human reviews feature breakdown, approves.

### 8. Execute (Ralph Loop)

```bash
# Option A: Use the wrapper script
./scripts/ralph-loop.sh --max-iterations 50

# Option B: Manual loop
while true; do
  opencode run "/globex-run"
done
```

Each iteration:
1. Reads fresh state from files
2. Picks ONE feature
3. Implements and verifies
4. Pauses for human manual verification
5. Commits and exits

Loop continues until `<promise>ALL_FEATURES_COMPLETE</promise>`.

## Feature Sizing

Features are sized to fit ~50% of agent context window:

| Constraint | Limit |
|------------|-------|
| Estimated time | 30-60 min |
| Files touched | 10-20 max |
| Lines changed | ~500 max |
| Dependencies | 0-2 other features |

If larger, split into Setup → Core → Polish.

## Erecting Signs

When the agent learns operational knowledge, it persists to `.globex/progress.md`:

```
globex_update_progress(learning: "Run migrations before seeding test data")
```

Future iterations read these learnings during "getting up to speed" phase.

## Project Structure

```
globex/
├── src/
│   ├── index.ts              # Plugin entry point
│   ├── state/
│   │   ├── types.ts          # Phase, Approval, ExecutionState types
│   │   └── persistence.ts    # State CRUD operations
│   └── tools/
│       ├── globex-init.ts
│       ├── globex-status.ts
│       ├── save-artifact.ts
│       ├── approve-phase.ts
│       ├── verify-citation.ts
│       ├── check-convergence.ts
│       ├── update-feature.ts
│       ├── get-next-feature.ts
│       └── update-progress.ts
├── skills/
│   ├── globex-init.md
│   ├── globex-status.md
│   ├── globex-research.md
│   ├── globex-interview.md
│   ├── globex-plan.md
│   ├── globex-features.md
│   └── globex-run.md
├── scripts/
│   └── ralph-loop.sh         # External loop wrapper
├── tests/
│   ├── state.test.ts
│   └── tools.test.ts
├── opencode.json             # Skill registrations
├── package.json
└── tsconfig.json
```

## Tools

| Tool | Description |
|------|-------------|
| `globex_init` | Initialize new project |
| `globex_status` | Get current phase and state |
| `globex_save_artifact` | Save .md/.json artifacts |
| `globex_approve_phase` | Record approval and transition |
| `globex_verify_citation` | Validate file:line citations |
| `globex_check_convergence` | Track interview questions/time |
| `globex_update_feature` | Mark feature complete |
| `globex_get_next_feature` | Pick next eligible feature |
| `globex_update_progress` | Update progress.md, add learnings |

## Development

```bash
# Install deps
bun install

# Run all checks (lint + build + test)
bun run check

# Individual commands
bun run lint      # oxlint
bun run build     # tsc
bun test          # bun test
```

## State Files

All state lives in `.globex/`:

```
.globex/
├── state.json      # Phase, approvals, execution state
├── research.md     # Research findings
├── research.json   # Structured research data
├── plan.md         # Implementation plan
├── plan.json       # Structured plan data
├── features.json   # Feature list with pass/fail
└── progress.md     # Current progress, learnings
```

## License

MIT
