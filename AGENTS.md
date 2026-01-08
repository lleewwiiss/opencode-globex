# AGENTS.md

CLI tool for agentic PRD generation with human-in-the-loop validation.

## Build Commands

```bash
bun run build          # TypeScript compilation (tsc)
bun run dev            # Watch mode compilation
bun run check          # lint + build + test (use before commit)
```

## Test Commands

```bash
bun test                              # All tests
bun test cli/tests/loop/ralph.test.ts # Single file
bun test cli/tests/loop/ralph.test.ts -t "executes"  # Single test by name
bun test --watch                      # Watch mode
bun test:unit                         # Unit tests only
bun test:integration                  # Integration tests only
```

## Lint Commands

```bash
bun run lint           # oxlint cli/src/
bun run lint:fix       # oxlint with auto-fix
```

## Architecture

- **OpenCode SDK**: `@opencode-ai/sdk` for spawning agent sessions
- **TUI Framework**: `@opentui/solid` for terminal UI
- **Runtime**: Bun (not Node.js)
- **FP Library**: Effect-TS exclusively - no raw Promises or try-catch
- **Module Format**: ESM with `.js` extensions in imports

## Code Style

### Imports

Order: external packages > internal modules > types

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { Effect, Schema } from "effect"
import * as path from "node:path"
import { loadState } from "./state/persistence.js"  // .js extension required
import type { Phase } from "./state/types.js"
```

### Effect-TS Patterns

Use Effect.gen for composable operations:

```typescript
const effect = Effect.gen(function* () {
  const state = yield* readState(workdir)
  yield* writeState(workdir, updatedState)
  return result
})
await Effect.runPromise(effect)
```

Error handling via tagged errors:

```typescript
export class StateNotFoundError extends Schema.TaggedError<StateNotFoundError>()(
  "StateNotFoundError",
  { path: Schema.String }
) {}
```

Layer composition for dependency injection:

```typescript
const PersistenceLayer = GlobexPersistenceLive.pipe(
  Layer.provide(NodeFileSystem.layer)
)
```

### Schema Definitions

Use Effect Schema for validation:

```typescript
export const PhaseSchema = Schema.Union(
  Schema.Literal("init"),
  Schema.Literal("plan"),
  Schema.Literal("execute")
)
export type Phase = Schema.Schema.Type<typeof PhaseSchema>

export const FeatureSchema = Schema.Struct({
  id: Schema.String,
  passes: Schema.Boolean,
  optional: Schema.optional(Schema.String),
  withDefault: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
```

### Naming Conventions

- Files: kebab-case (`ralph.ts`, `persistence.ts`)
- Types/Interfaces: PascalCase (`GlobexState`, `Feature`)
- Functions: camelCase (`runRalphLoop`, `loadState`)
- Constants: SCREAMING_SNAKE_CASE or camelCase depending on scope

### Error Handling

Return JSON with success/error pattern for functions that need structured responses:

```typescript
if (errorCondition) {
  return JSON.stringify({
    success: false,
    error: "Descriptive error message",
  })
}
return JSON.stringify({
  success: true,
  data: result,
})
```

For Effect operations, use mapError for tagged errors:

```typescript
yield* fs.readFileString(path).pipe(
  Effect.mapError(() => new StateNotFoundError({ path }))
)
```

### TypeScript

- Strict mode enabled
- Use `type` imports for type-only imports
- Prefer interfaces for object shapes, types for unions/aliases
- No `any` - use `unknown` and narrow

### Tests

Bun test framework with describe/test/expect:

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"

describe("feature", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-test-"))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  test("does something", async () => {
    const result = await someFunction(testDir)
    expect(result.success).toBe(true)
  })
})
```

## Project Structure

```
cli/
  bin/
    globex.ts           # CLI entry point (yargs)
  src/
    index.ts            # Main entry, TUI startup
    app.tsx             # TUI application (OpenTUI/Solid)
    config.ts           # Configuration loading
    git.ts              # Git operations
    loop/
      ralph.ts          # Ralph loop executor
      signals.ts        # File marker detection
    phases/
      engine.ts         # Phase execution
      approval.ts       # Approval handling
    agents/
      prompts.ts        # Agent prompt templates
    opencode/
      server.ts         # OpenCode server management
      session.ts        # Session handling
      events.ts         # Event subscription
    state/
      types.ts          # TypeScript types
      schema.ts         # Effect Schema definitions
      persistence.ts    # State CRUD
    features/
      manager.ts        # Feature tracking
    artifacts/
      save.ts           # Artifact persistence
      validators.ts     # Citation validation
    components/         # TUI components
  tests/
    *.test.ts           # Test files
```

## Globex Workflow Phases

init -> research -> research_interview -> plan -> plan_interview -> features -> execute -> complete

Each phase has artifacts stored in `.globex/projects/{projectId}/`:
- `state.json` - workflow state
- `research.md`, `plan.md` - markdown artifacts
- `features.json` - feature list with passes/blocked status
- `progress.md` - execution progress

## Globex Learnings (auto-generated)

- opencode run output contains terminal escape codes. Use `grep -a` (treat as text) when parsing output files, otherwise grep reports "Binary file matches" instead of actual content.
<!-- end globex learnings -->
