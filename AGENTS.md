# AGENTS.md

OpenCode plugin for agentic PRD generation with human-in-the-loop validation.

## Build Commands

```bash
bun run build          # TypeScript compilation (tsc)
bun run dev            # Watch mode compilation
bun run check          # lint + build + test (use before commit)
```

## Test Commands

```bash
bun test                              # All tests
bun test tests/tools.test.ts          # Single file
bun test tests/tools.test.ts -t "globex_init"  # Single test by name
bun test --watch                      # Watch mode
bun test:unit                         # Unit tests only
bun test:integration                  # Integration tests only
```

## Lint Commands

```bash
bun run lint           # oxlint src/
bun run lint:fix       # oxlint with auto-fix
```

## Architecture

- **Plugin SDK**: `@opencode-ai/plugin` for tool/command/agent definitions
- **Runtime**: Bun (not Node.js)
- **FP Library**: Effect-TS exclusively - no raw Promises or try-catch
- **Module Format**: ESM with `.js` extensions in imports

## Code Style

### Imports

Order: external packages > internal modules > types

```typescript
import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { Effect, Schema } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { someFunction } from "../state/persistence.js"  // .js extension required
import type { GlobexState } from "../state/types.js"
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

### Tool Definitions

```typescript
export const createSomeTool = (workdir: string): ToolDefinition => tool({
  description: `Brief description.

Returns JSON: {success: true, ...} or {success: false, error}`,
  args: {
    required: tool.schema.string(),
    optional: tool.schema.boolean().optional(),
  },
  async execute(args) {
    // Implementation
    return JSON.stringify({ success: true, ... })
  },
})
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

- Files: kebab-case (`save-artifact.ts`, `get-next-feature.ts`)
- Types/Interfaces: PascalCase (`GlobexState`, `ToolDefinition`)
- Functions: camelCase (`createGlobexInit`, `getActiveProject`)
- Constants: SCREAMING_SNAKE_CASE or camelCase depending on scope
- Tool names: snake_case (`globex_init`, `globex_save_artifact`)

### Error Handling

Return JSON with success/error pattern:

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

describe("tool_name", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "globex-test-"))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  test("does something", async () => {
    const tool = createTool(testDir)
    const result = await tool.execute(args, mockContext())
    const parsed = JSON.parse(result)
    expect(parsed.success).toBe(true)
  })
})
```

## Project Structure

```
src/
  index.ts              # Plugin entry, commands, agents, event handlers
  tools/                # Tool implementations (one per file)
  state/
    types.ts            # TypeScript types
    schema.ts           # Effect Schema definitions
    service.ts          # Effect service layer
    persistence.ts      # Async wrappers for service
tests/
  *.test.ts             # Test files mirror src structure
```

## Globex Workflow Phases

init -> plan -> interview -> features -> execute

Each phase has artifacts stored in `.globex/projects/{projectId}/`:
- `state.json` - workflow state
- `research.md`, `plan.md` - markdown artifacts
- `features.json` - feature list with passes/blocked status
- `progress.md` - execution progress

## Globex Learnings (auto-generated)

<!-- end globex learnings -->
