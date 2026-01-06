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
> /globex-research      # Agent explores codebase
> /globex-interview     # Human validates research

> /globex-plan          # Agent creates implementation plan  
> /globex-interview     # Human validates plan

> /globex-features      # Agent breaks into atomic features
> /globex-interview     # Human validates features
```

### Execute

```bash
./scripts/ralph-loop.sh --max-iterations 50
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
globex_update_progress(learning: "Run migrations before seeding")
```

---

## Project Structure

```
globex/
├── src/
│   ├── index.ts                 # Plugin entry
│   ├── state/
│   │   ├── types.ts             # Phase, ExecutionState types
│   │   └── persistence.ts       # State CRUD
│   └── tools/                   # 9 custom tools
├── skills/                      # 7 skill markdown files
├── scripts/
│   └── ralph-loop.sh            # External loop wrapper
├── tests/                       # 35 tests
├── opencode.json                # Skill registrations
└── package.json
```

---

## Tools

| Tool | Description |
|:-----|:------------|
| `globex_init` | Initialize project |
| `globex_status` | Get current phase |
| `globex_save_artifact` | Save .md/.json files |
| `globex_approve_phase` | Record approval, transition |
| `globex_verify_citation` | Validate file:line citations |
| `globex_check_convergence` | Track interview progress |
| `globex_update_feature` | Mark feature complete |
| `globex_get_next_feature` | Pick next eligible feature |
| `globex_update_progress` | Update progress, add learnings |

---

## Development

```bash
bun run check    # lint + build + test
bun run lint     # oxlint
bun run build    # tsc
bun test         # 35 tests
```

---

## State Files

```
.globex/
├── state.json       # Phase, approvals, execution state
├── research.md      # Research findings
├── plan.md          # Implementation plan
├── features.json    # Feature list with pass/fail
└── progress.md      # Current progress, learnings
```

---

## License

MIT

---

<p align="center">
  <em>"Don't call me Mr. Scorpion. It's Mr. Scorpio, but don't call me that either."</em>
</p>
