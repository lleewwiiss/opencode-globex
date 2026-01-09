# Progress

## Feature: registry-service-core

### Status: complete

### Changes Made
- **cli/src/state/registry.ts**: Created new file with RegistryService following persistence.ts pattern

### Implementation
- `RegistryEntry` interface: name, repoPath, phase, worktreePath?, branchName?, createdAt, updatedAt
- `Registry` interface: projects: Record<string, RegistryEntry>
- `RegistryReadError` and `RegistryWriteError` tagged errors (Schema.TaggedError)
- `RegistryService` with Context.Tag, `RegistryServiceLive` with Layer.effect
- CRUD methods: loadRegistry, saveRegistry, getProject, upsertProject, removeProject, listProjects, listProjectsForRepo
- Convenience exports with pre-wired RegistryLayer (same pattern as persistence.ts lines 106-134)
- Uses `~/.globex/registry.json` via `os.homedir()` + path.join

### Verification
- Build: ✓
- Tests: ✓ (381 pass, 37 unrelated failures from decimal.js package resolution in references/)
- Lint: ✓ (5 warnings, 0 errors - none in registry.ts)

### Acceptance Criteria
- [x] registry.ts file created at cli/src/state/registry.ts
- [x] RegistryEntry interface with name, repoPath, phase, worktreePath, branchName, createdAt, updatedAt
- [x] Registry interface with projects: Record<string, RegistryEntry>
- [x] RegistryReadError and RegistryWriteError tagged errors
- [x] RegistryService with loadRegistry, saveRegistry, getProject, upsertProject, removeProject, listProjects, listProjectsForRepo
- [x] Uses ~/.globex/registry.json for storage

---

## Feature: state-workspace-schema

### Status: complete

### Changes Made
- **cli/src/state/schema.ts:190-202**: Added `WorkspaceTypeSchema` (Union of Literal) and `WorkspaceInfoSchema` (Struct with optional fields)
- **cli/tests/loop/ralph.test.ts**: Added `initialCommitHash: "test-initial-hash"` to all 9 `RalphLoopContext` instances to fix build errors from prior uncommitted RalphLoopContext changes

### Implementation
- `WorkspaceTypeSchema`: `Schema.Union(Schema.Literal("current"), Schema.Literal("worktree"))`
- `WorkspaceInfoSchema`: Struct with `type`, `worktreePath?`, `branchName?`, `createdAt?`
- Followed existing patterns from lines 3-8 and 10-18

### Verification
- Build: ✓
- Tests: ✓ (158 pass in cli/tests/)
- Lint: ✓ (4 warnings, 0 errors)

### Acceptance Criteria
- [x] WorkspaceTypeSchema validates 'current' | 'worktree'
- [x] WorkspaceInfoSchema validates WorkspaceInfo shape with optional fields
- [x] Schemas export correctly
- [x] Build passes

---

## Feature: git-worktree-tests

### Status: complete

### Changes Made
- **cli/tests/git-worktree.test.ts:21-33**: Fixed path resolution using `fs.realpath(os.tmpdir())` to handle macOS symlinks (`/var` -> `/private/var`), added `stdio: "ignore"` to git commands

### Tests Implemented
1. `createWorktree` > creates directory and branch - verifies return value and directory creation
2. `listWorktrees` > returns created worktree - verifies worktree appears in list with correct branch
3. `listWorktrees` > returns main worktree - verifies main repo worktree is listed
4. `removeWorktree` > removes directory - verifies directory deletion and list update

### Verification
- Build: ✓
- Tests: ✓ (79 pass)
- Lint: ✓ (3 warnings, 0 errors)

### Files Changed
- cli/tests/git-worktree.test.ts (1 edit - path resolution fix)

---

## Feature: gitservice-worktree-implementations (previous)

### Status: complete

### Changes Made
- **cli/src/git.ts:122-126**: Updated `removeWorktree` to use `--force` flag and error tolerance via `Effect.catchAll(() => Effect.void)`

### Implementation Review
All 4 methods were already implemented:
1. `createWorktree` (lines 115-120): calls `git worktree add -b branch path` ✓
2. `removeWorktree` (lines 122-126): now calls `git worktree remove --force path` with error tolerance ✓
3. `listWorktrees` (lines 127-149): parses `git worktree list --porcelain` into `Worktree[]` ✓
4. `mergeWorktree` (lines 151-179): merges branch with `--no-edit`, handles conflicts, returns `MergeResult` ✓

### Verification
- Build: ✓
- Tests: ✓ (150 pass)
- Lint: ✓ (warnings only, no errors)

### Files Changed
- cli/src/git.ts (1 line edit)

---

## Feature: registry-service-wrappers

### Status: complete

### Changes Made
- **cli/src/state/registry.ts**: Renamed Effect wrappers and added async wrappers

### Implementation
Renamed existing Effect wrappers and added async wrappers following patterns from persistence.ts:102-134 and git.ts:131-141.

**Effect wrappers (all provide RegistryLayer):**
- `loadRegistryEffect` 
- `saveRegistryEffect`
- `getProjectFromRegistry`
- `upsertProjectInRegistry`
- `removeProjectFromRegistry`
- `listAllProjects`
- `listRepoProjects`

**Async wrappers:**
- `loadRegistry`
- `getProject`
- `upsertProject`
- `removeProject`

### Verification
- Build: ✓
- Tests: ✓ (79 pass)
- Lint: ✓ (4 pre-existing warnings, 0 errors)

### Acceptance Criteria
- [x] loadRegistryEffect, getProjectFromRegistry, upsertProjectInRegistry, removeProjectFromRegistry, listAllProjects, listRepoProjects Effect wrappers
- [x] loadRegistry, getProject, upsertProject, removeProject async wrappers
- [x] All wrappers provide RegistryLayer
- [x] Exports are added

### Files Changed
- cli/src/state/registry.ts

---

## Feature: registry-tests

### Status: complete

### Changes Made
- **cli/tests/state/registry.test.ts**: Created new test file for registry CRUD operations

### Implementation
Tests use mocked HOME directory via `spyOn(os, "homedir")` to isolate registry file to temp directory.

**Test cases:**
1. `loadRegistry` > returns empty projects when no file exists
2. `loadRegistry` > reads existing registry file
3. `upsertProject` > creates registry file when none exists
4. `upsertProject` > updates existing project entry
5. `upsertProject` > adds multiple projects
6. `removeProject` > removes entry from registry
7. `removeProject` > handles removing non-existent project gracefully
8. `getProject` > returns undefined for non-existent project
9. `getProject` > returns entry for existing project

### Verification
- Build: Pre-existing errors in header.tsx (createMemo not imported) - unrelated to test file
- Tests: ✓ (9 pass, all registry tests green)
- Lint: ✓ (1 warning unrelated to test file)

### Acceptance Criteria
- [x] Test file exists at cli/tests/state/registry.test.ts
- [x] Tests loadRegistry returns empty on no file
- [x] Tests upsertProject creates registry file
- [x] Tests removeProject removes entry
- [x] Tests mock HOME dir for isolation

### Files Changed
- cli/tests/state/registry.test.ts (new file)

---

## Feature: cli-status-command

### Status: complete

### Changes Made
- **cli/bin/globex.ts:67-106**: Added `status` subcommand (already implemented in file)

### Implementation
The status command was already implemented, meeting all acceptance criteria:
- Calls `loadRegistry()` from registry.ts to get projects from `~/.globex/registry.json`
- Displays columns: ID (33 chars), PHASE (18 chars), PATH
- Uses `→` arrow for active project (from `getActiveProject(workdir)`)
- Shows `(current)` for projects where `entry.repoPath === workdir` and no worktree

### Verification
- Build: ✓
- Tests: ✓ (176 pass)
- Lint: ✓ (1 pre-existing warning, 0 errors)

### Acceptance Criteria
- [x] globex status lists all projects from ~/.globex/registry.json
- [x] Shows project ID, phase, workspace path columns
- [x] Marks active project with arrow indicator
- [x] Shows (current) for projects in current repo without worktree

### Files Changed
- cli/bin/globex.ts (pre-existing implementation verified)

---

## Feature: cli-switch-command

### Status: complete

### Changes Made
- **cli/bin/globex.ts:7**: Added `getProject` import from registry.ts
- **cli/bin/globex.ts:107-143**: Added `switch <project-id>` subcommand

### Implementation
Follows yargs command pattern from lines 66-127 (status and init commands):
- Positional arg `<project-id>` with demandOption
- Looks up project via `getProject(projectId)` async wrapper
- If not found: error message + exit(1)
- If in current repo: sets active-project, prints cd if worktree exists
- If in different repo: prints cd to worktree or repoPath

### Verification
- Build: ✓
- Tests: ✓ (176 pass)
- Lint: ✓ (1 pre-existing warning, 0 errors)

### Acceptance Criteria
- [x] globex switch <id> looks up project in registry
- [x] Sets active-project if in current repo
- [x] Prints cd command if project has worktree
- [x] Prints cd command if project in different repo
- [x] Errors if project not found

### Files Changed
- cli/bin/globex.ts
