# AGENTS.md

## Scope
- Applies to entire repo unless overridden.
- Root project is `globex` CLI + TUI.

## Quick Facts
- Runtime: Bun + Node APIs.
- Language: TypeScript (ESM, `type: module`).
- UI: Solid + OpenTUI (`.tsx`).
- Effects: `effect` + `@effect/platform`.
- Lint: `oxlint`.
- Build: `tsc`.
- Tests: `bun test` in `cli/tests/`.

## Install
- `bun install`
- `bun link` if you need global `globex`.

## Build / Lint / Test
- Build all: `bun run build` (runs `tsc`).
- Lint all: `bun run lint` (runs `oxlint cli/src/`).
- Lint fix: `bun run lint:fix`.
- Tests all: `bun test cli/`.
- Tests via script: `bun run test`.
- Unit tests: `bun run test:unit`.
- Integration tests: `bun run test:integration`.
- Watch tests: `bun run test:watch`.
- Full check: `bun run check` (lint + build + test).

## Single Test
- Run one file: `bun test cli/tests/path/to/file.test.ts`.
- Example: `bun test cli/tests/loop/ralph.test.ts`.

## Project Layout
- `cli/bin/` CLI entry.
- `cli/src/` app, loop, state, components.
- `cli/tests/` Bun tests.
- `dist/` build output (generated).
- `.globex/` runtime state (gitignored).

## TypeScript / ESM
- Use ESM syntax; no `require`.
- Use `.js` extension in local imports.
- Prefer `import type` for types.
- `tsconfig.json` is strict; no `any` leaks.
- Keep async logic typed (`Promise<T>` etc).

## Imports
- Order: external → `node:` → local.
- Group with blank line between sections.
- Use namespace imports for Node builtins (`import * as fs`).
- Prefer named imports for local modules.
- Keep type-only imports separate when clarity helps.

## Formatting
- 2-space indentation.
- No semicolons.
- Double quotes.
- Trailing commas in multi-line objects/arrays.
- Keep lines short-ish; wrap long args.

## Naming
- camelCase for vars/functions.
- PascalCase for types/classes/components.
- kebab-case for filenames (`features-persistence.ts`).
- Constants in `SCREAMING_SNAKE` only when truly constant.
- Use clear, explicit names; avoid terse abbreviations.

## Types & Data
- Export interfaces/types for shared shapes.
- Use `Schema.TaggedError` for error types.
- Prefer explicit return types on exported fns.
- Keep JSON schema in `cli/src/state/schema.ts`.
- Validate external data before use.

## Error Handling
- Prefer typed errors + `Effect.mapError`.
- Log errors with context via `log()`.
- Avoid swallowing errors unless user-facing safe.
- Use fallback strings when reading artifacts fails.

## Effect Patterns
- Use `Effect.gen` + `yield*` for pipelines.
- Use `Layer` for live service wiring.
- Convert to promises at boundaries (`Effect.runPromise`).
- Keep `Effect` logic isolated from UI components.

## Solid / OpenTUI
- Components live in `cli/src/components/`.
- Use functional components.
- Keep state updates via setters (`setState`).
- Avoid side effects during render; defer with `queueMicrotask`.
- Use `jsxImportSource` set to `@opentui/solid`.

## State + Persistence
- State files under `.globex/`.
- Use helpers in `cli/src/state/persistence.ts`.
- Keep file IO async (`fs/promises`).
- Sanitize project IDs (`sanitizeProjectId`).

## Git / Worktrees
- Use `cli/src/git.ts` helpers, not raw shell.
- Worktrees live under `~/.globex/workspaces/`.
- Worktree branch naming: `globex/<projectId>`.

## Tests
- Use Bun test (`bun:test`).
- Prefer `describe`/`test`/`expect`.
- Use `mock`/`spyOn` for dependencies.
- Clean temp dirs in `afterEach`.
- Keep tests hermetic; avoid network.

## Comments
- Prefer self-documenting code.
- Comments only when logic is non-obvious.
- Keep comments short, factual.

## Docs / Artifacts
- Artifacts are `research.md`, `plan.md`, `features.json`.
- Keep docs consistent with runtime expectations.
- Avoid generating new docs unless asked.

## Concurrency / Signals
- Loop uses marker files: `.globex-done`, `.globex-approved`, `.globex-rejected`, `.globex-pause`.
- Use helpers in `cli/src/loop/signals.ts`.

## No Cursor/Copilot Rules
- `.cursor/rules/` not present.
- `.cursorrules` not present.
- `.github/copilot-instructions.md` not present.

## Safety
- Do not edit `.globex/` unless feature requires.
- Do not add new deps without request.
- Do not add shell scripts for loop control.
- Keep changes minimal and scoped.

## Verification Notes
- Commands above sourced from `package.json`.
- `tsconfig.json` defines strict ESM + `jsxImportSource`.
- `README.md` lists dev commands.

## When Unsure
- Check existing patterns in `cli/src/`.
- Ask before broad refactors.
- Explain uncertainty plainly.

## End
