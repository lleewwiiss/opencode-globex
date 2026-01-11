<p align="center">
  <img src="globex.jpg" alt="Globex Corporation - Hank Scorpio and Ralph Wiggum" width="600">
</p>

<h1 align="center">Globex</h1>

<p align="center">
  <strong>Agentic PRD generation with human-in-the-loop validation</strong>
</p>

<p align="center">
  CLI tool powered by <a href="https://opencode.ai">OpenCode</a>
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

- **Standalone CLI** — Run `globex` from any project directory
- **TUI interface** — Real-time progress display with OpenTUI
- **@ file references** — Autocomplete to attach files to your project description
- **OpenCode SDK integration** — Spawns sessions for each agent
- **Phase-based workflow** — Research, plan, features, execute
- **Coach/player pattern** — Ralph implements, Wiggum validates

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

Each phase requires human approval before proceeding.

---

## Installation

```bash
git clone https://github.com/yourorg/globex.git
cd globex
bun install
bun link
```

This makes the `globex` command available globally.

---

## Usage

### Initialize a new project

```bash
globex init "Add dark mode support"
```

### Continue existing workflow

```bash
globex continue              # Resume active project
globex continue my-project   # Resume specific project
```

### Check status

```bash
globex status
```

### Options

```bash
globex --help                          # Show all commands
globex init "desc" --model anthropic/claude-sonnet-4  # Specify model
```

---

## Ralph Loop

Coach/player pattern with two agents per iteration:

1. **Ralph (player)** — Implements ONE feature, outputs `<ralph>DONE:FEATURE_ID</ralph>`
2. **Wiggum (coach)** — Validates implementation against acceptance criteria
   - Outputs `<wiggum>APPROVED</wiggum>` if all criteria pass
   - Outputs `<wiggum>REJECTED:reason</wiggum>` with specific feedback
3. On rejection, Ralph retries with feedback in next iteration
4. Fresh context between iterations (stateless execution)

Loop continues until all features complete.

### Feature Sizing

Features sized for ~50% of agent context window:

| Constraint | Limit |
|:-----------|:------|
| Time | 30-60 min |
| Files | 10-20 max |
| Lines | ~500 max |
| Dependencies | 0-2 features |

### Feature States

| State | Description |
|:------|:------------|
| `passes: false` | Not yet implemented |
| `passes: true` | Implemented and verified |
| `blocked: true` | Cannot progress (skipped by loop) |

---

## Project Structure

```
globex/
├── cli/
│   ├── bin/
│   │   └── globex.ts          # CLI entry point (yargs)
│   ├── src/
│   │   ├── index.ts           # Main entry, TUI startup
│   │   ├── app.tsx            # TUI application (OpenTUI/Solid)
│   │   ├── loop/
│   │   │   ├── ralph.ts       # Ralph loop executor
│   │   │   └── signals.ts     # File marker detection
│   │   ├── phases/
│   │   │   ├── engine.ts      # Phase execution engine
│   │   │   └── approval.ts    # Approval handling
│   │   ├── agents/
│   │   │   ├── prompts.ts     # Prompt loader
│   │   │   └── prompts/       # Prompt markdown
│   │   ├── opencode/
│   │   │   ├── server.ts      # OpenCode server management
│   │   │   ├── session.ts     # Session handling
│   │   │   └── events.ts      # Event subscription
│   │   ├── state/
│   │   │   ├── types.ts       # TypeScript types
│   │   │   ├── schema.ts      # Effect Schema definitions
│   │   │   └── persistence.ts # State CRUD
│   │   ├── features/
│   │   │   └── manager.ts     # Feature tracking
│   │   ├── artifacts/
│   │   │   ├── save.ts        # Artifact persistence
│   │   │   └── validators.ts  # Citation validation
│   │   ├── components/        # TUI components
│   │   ├── config.ts          # Configuration loading
│   │   └── git.ts             # Git operations
│   └── tests/                 # Test files
├── .globex/                   # Runtime state (gitignored)
├── package.json
└── tsconfig.json
```

---

## State Files

```
.globex/
├── config.json             # CLI configuration
└── projects/{projectId}/
    ├── state.json          # Phase, approvals, execution state
    ├── research.md         # Research findings
    ├── plan.md             # Implementation plan
    ├── features.json       # Feature list with pass/fail status
    └── progress.md         # Current progress
```

---

## Development

```bash
bun run check    # lint + build + test
bun run lint     # oxlint cli/src/
bun run build    # tsc
bun test         # all tests
```

---

## Acknowledgements

Globex stands on the shoulders of giants. Massive thanks to:

### [OpenCode](https://github.com/anomalyco/opencode)

OpenCode is an exceptional open-source AI coding agent that powers Globex's agent sessions. The codebase is beautifully architected—clean TypeScript with Bun, Zod for validation, and an elegant TUI built with OpenTUI and SolidJS. The @ file reference autocomplete in Globex is directly inspired by (and learned from) OpenCode's prompt component implementation. If you're building AI-powered developer tools, OpenCode is the gold standard to study.

### [opencode-ralph](https://github.com/Hona/opencode-ralph)

Luke Parker's `@hona/ralph-cli` is the definitive implementation of Ralph-driven development. It's a beautifully minimal CLI that reads a plan, picks one task, completes it, commits, and repeats—with fresh context every iteration. Globex's execution loop is directly inspired by opencode-ralph's architecture. The TUI patterns, state persistence, and OpenCode SDK integration we use all trace back to studying this codebase. If you want pure Ralph-driven development without the PRD workflow, use opencode-ralph directly.

### [Geoffrey Huntley's Ralph Driven Development](https://ghuntley.com/ralph/)

The conceptual foundation. Geoffrey's insight that agents succeed through determined retry (like Ralph Wiggum stumbling into success) is the philosophy behind everything here. Fresh context every iteration eliminates drift. Deterministic failures become debuggable. AGENTS.md accumulates wisdom. This is the way.

---

## License

MIT

---

<p align="center">
  <em>"Don't call me Mr. Scorpion. It's Mr. Scorpio, but don't call me that either."</em>
</p>
