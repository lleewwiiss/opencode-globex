<p align="center">
  <img src="globex.jpg" alt="Globex Corporation - Hank Scorpio and Ralph Wiggum" width="600">
</p>

<h1 align="center">Globex</h1>

<p align="center">
  <strong>Agentic PRD generation with human-in-the-loop validation</strong>
</p>

<p align="center">
  An <a href="https://opencode.ai">OpenCode</a> plugin
</p>

<p align="center">
  <a href="#philosophy">Philosophy</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#ralph-loop">Ralph Loop</a> •
  <a href="#development">Development</a>
</p>

---

## Philosophy

> "Human leverage is highest at spec level, lowest at implementation."

Front-load human validation into research and planning. Execution runs autonomously.

Named after Hank Scorpio's company. The "Ralph loop" is named after Ralph Wiggum—persistent iteration despite setbacks.

**Based on:**
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Geoffrey Huntley: Ralph Driven Development](https://ghuntley.com/ralph/)
- [Anthropic: Ralph Wiggum Plugin](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum)

## Features

- **Automatic command registration** — All `/globex-*` commands register via plugin config hook
- **Subagent isolation** — Research, interview, plan, and features phases run in isolated subagents
- **Toast notifications** — Visual feedback on phase approvals and feature completions
- **Session events** — Auto-detects existing projects, logs errors to progress.md
- **37 tests** — Full coverage of state persistence and tools

---

## Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Research   │────▶│    Plan     │────▶│  Features   │────▶│   Execute   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
   Interview           Interview           Interview          Ralph Loop
   (approve)           (approve)           (approve)         (autonomous)
```

Each phase requires human approval via `/globex-interview` before proceeding.

---

## Installation

```bash
git clone https://github.com/yourorg/globex.git
cd globex
bun install
bun run build
```

Add to your OpenCode configuration or symlink to plugins directory.

---

## Usage

### Initialize

```bash
opencode
> /globex-init
```

### Research → Plan → Features

```bash
> /globex-research      # Subagent explores codebase (read-only)
> /globex-interview     # Subagent validates research with human

> /globex-plan          # Subagent creates implementation plan  
> /globex-interview     # Subagent validates plan with human

> /globex-features      # Subagent breaks into atomic features
> /globex-interview     # Subagent validates features with human

> /globex-status        # Check current phase anytime
> /globex-help          # Show workflow help
```

### Execute

```bash
./scripts/ralph-loop.sh --max-iterations 50

# To stop the loop, press Ctrl+C
```

---

## Ralph Loop

Stateless, autonomous execution. Each iteration:

1. **Get up to speed** — Read progress.md, features.json, git log
2. **Health check** — Build passes? Tests pass?
3. **Pick ONE feature** — Smallest eligible feature
4. **Implement** — Follow existing patterns
5. **Verify** — Automated checks
6. **Pause** — Human manual verification
7. **Commit** — Clean state for next iteration
8. **Exit** — Loop restarts with fresh context

Loop continues until `<promise>ALL_FEATURES_COMPLETE</promise>`.

### Feature Sizing

Features sized for ~50% of agent context window:

| Constraint | Limit |
|:-----------|:------|
| Time | 30-60 min |
| Files | 10-20 max |
| Lines | ~500 max |
| Dependencies | 0-2 features |

### Erecting Signs

Agent persists operational knowledge for future iterations:

```
globex_add_learning(learning: "Run migrations before seeding")
```

---

## Project Structure

```
globex/
├── src/
│   ├── index.ts                 # Plugin entry (commands, agents, events)
│   ├── state/
│   │   ├── types.ts             # Phase, ExecutionState types
│   │   ├── schema.ts            # Effect Schema definitions
│   │   ├── service.ts           # GlobexPersistence service layer
│   │   └── persistence.ts       # State CRUD (re-exports from service)
│   └── tools/                   # 11 custom tools
├── skills/                      # Skill markdown files (reference)
├── scripts/
│   └── ralph-loop.sh            # External loop wrapper
├── tests/                       # 37 tests (state + tools)
├── opencode.json                # Plugin configuration
└── package.json
```

---

## Tools

| Tool | Description |
|:-----|:------------|
| `globex_init` | Initialize project with name and description |
| `globex_status` | Get current phase and project state |
| `globex_save_artifact` | Save .md/.json files to .globex/ |
| `globex_approve_phase` | Record approval decision, transition phase |
| `globex_verify_citation` | Validate file:line citations exist |
| `globex_check_convergence` | Track interview progress toward completion |
| `globex_update_feature` | Mark feature as complete/blocked |
| `globex_get_next_feature` | Pick next eligible feature by priority |
| `globex_update_progress` | Generate progress.md with current state |
| `globex_add_learning` | Write operational knowledge to AGENTS.md |
| `globex_set_phase` | Manually set workflow phase |

---

## Development

```bash
bun run check    # lint + build + test
bun run lint     # oxlint
bun run build    # tsc
bun test         # 37 tests
```

---

## State Files

```
.globex/
├── state.json              # Phase, approvals, execution state
├── research.md             # Research findings
├── research.citations.json # File:line citations for research claims
├── plan.md                 # Implementation plan
├── plan.risks.json         # Risk assessment with mitigations
├── features.json           # Feature list with pass/fail status
└── progress.md             # Current progress, learnings
```

---

## License

MIT

---

<p align="center">
  <em>"Don't call me Mr. Scorpion. It's Mr. Scorpio, but don't call me that either."</em>
</p>
