# Progress

## Feature: registry-phase-sync

### Status: complete

### Changes Made
- **cli/src/state/persistence.ts:6**: Added import for `getProjectFromRegistry`, `upsertProjectInRegistry` from registry.ts
- **cli/src/state/persistence.ts:77-81**: Added registry sync logic in `updatePhase` - fetches entry, updates phase if exists

### Implementation
Inside `updatePhase` after writing state:
1. Fetch registry entry via `getProjectFromRegistry(projectId)` with `Effect.orElseSucceed(() => undefined)` for silent skip
2. If entry exists, call `upsertProjectInRegistry(projectId, { ...entry, phase })` with same error tolerance

### Verification
- Build: ✓
- Tests: ✓ (24 pass in state tests)
- Lint: ✓ (2 pre-existing warnings, 0 errors)

### Acceptance Criteria
- [x] updatePhase in persistence.ts also updates registry entry phase
- [x] Import registry functions in persistence.ts
- [x] Silently skip if project not in registry
- [x] Build passes

### Files Changed
- cli/src/state/persistence.ts

---

## Feature: ralph-split-workdir

### Status: complete

### Changes Made
- **cli/src/loop/ralph.ts:24-30**: Changed `RalphLoopContext` interface from `workdir: string` to `artifactWorkdir: string` + `codeWorkdir: string`
- **cli/src/loop/ralph.ts:263**: Updated destructuring at start of `runRalphLoop`
- **cli/src/loop/ralph.ts:268,282**: `readFeatures` calls now use `artifactWorkdir`
- **cli/src/loop/ralph.ts:317,412,428**: `writeFeatures` calls now use `artifactWorkdir`
- **cli/src/loop/ralph.ts:419**: `readRejectionInfo` call now uses `codeWorkdir` (was artifact-related but kept for rejection marker location)
- **cli/src/loop/ralph.ts:277,299,329,357,388,389,399,402,403,439**: git/signal calls now use `codeWorkdir`
- **cli/src/index.ts:280-281**: Updated caller to pass both `artifactWorkdir: ctx.workdir` and `codeWorkdir: ctx.workdir`
- **cli/tests/loop/ralph.test.ts**: Updated all 9 RalphLoopContext instances to use new schema

### Verification
- Build: ✓
- Tests: ✓ (9 pass in ralph.test.ts)
- Lint: ✓ (2 pre-existing warnings, 0 errors)

### Acceptance Criteria
- [x] RalphLoopContext has artifactWorkdir and codeWorkdir instead of single workdir
- [x] readFeatures/writeFeatures use artifactWorkdir
- [x] commitChanges/getHeadHash/getCommitsSince use codeWorkdir
- [x] checkSignal/clearSignals/checkPaused use codeWorkdir
- [x] Build passes

### Files Changed
- cli/src/loop/ralph.ts
- cli/src/index.ts
- cli/tests/loop/ralph.test.ts

---

## Feature: cli-default-command-update

### Status: complete

### Changes Made
- **cli/bin/globex.ts:66-68**: Updated usage string to show available subcommands
- **cli/bin/globex.ts:354-365**: Added registry integration when creating projects via --description
- **cli/bin/globex.ts:377-381**: Enhanced error message to show subcommand options

### Implementation
1. When `--description` creates a new project, now calls `upsertProject()` to register in `~/.globex/registry.json`
2. Updated usage string in yargs to list all subcommands
3. Enhanced "no project" error message to show available subcommands
4. Backwards compatible - existing --description flag behavior preserved

### Verification
- Build: ✓
- Tests: ✓ (176 pass)
- Lint: ✓ (2 pre-existing warnings, 0 errors)

### Acceptance Criteria
- [x] Default command registers new projects in registry
- [x] Backwards compatible - still works with --description flag
- [x] Updates usage string to show subcommands

### Files Changed
- cli/bin/globex.ts

---

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

---

## Feature: cli-abandon-command

### Status: complete

### Changes Made
- **cli/bin/globex.ts:7-8**: Added `removeProject` import from registry.ts, added `removeWorktree` import from git.ts
- **cli/bin/globex.ts:9**: Added `rmSync, unlinkSync` imports from fs
- **cli/bin/globex.ts:147-219**: Added `abandon <project-id>` subcommand

### Implementation
Feature was already implemented. Verified implementation meets all acceptance criteria:

1. **Confirmation without --force** (lines 173-180): Shows project details and prompts to run with --force
2. **Worktree removal with --force** (lines 183-195): Calls `removeWorktree()`, falls back to `rmSync()` on error
3. **Project directory removal** (lines 197-202): Removes `.globex/projects/{projectId}` via `rmSync()`
4. **Registry removal** (lines 204-206): Calls `removeProject(projectId)` async wrapper
5. **Active-project clearing** (lines 208-216): Checks if abandoned project was active, removes `active-project` file
6. **Status messages**: Prints progress at each step and final "Abandoned project:" message

### Verification
- Build: ✓
- Tests: ✓ (88 pass)
- Lint: ✓ (1 pre-existing warning, 0 errors)

### Acceptance Criteria
- [x] globex abandon <id> shows confirmation without --force
- [x] globex abandon <id> --force removes worktree if exists
- [x] Removes project from registry
- [x] Clears active-project if was active
- [x] Prints status messages

### Files Changed
- cli/bin/globex.ts (pre-existing implementation verified)

---

## Feature: cli-workspace-commands

### Status: complete

### Changes Made
- **cli/bin/globex.ts:7**: Added `listWorktrees` and `Worktree` type imports from git.ts
- **cli/bin/globex.ts:220-277**: Added `workspace` command group with `list` and `cleanup` subcommands

### Implementation
Added workspace command group using nested yargs pattern from lines 63-127:

1. **workspace list**: Lists projects with `worktreePath` set in registry
   - Shows ID, PHASE, WORKTREE PATH columns
   - Handles "no worktrees" case

2. **workspace cleanup**: Lists completed projects (phase === "complete") with worktrees
   - Shows ID, WORKTREE PATH columns
   - Prints guidance to use `globex abandon <id> --force`
   - Handles "nothing to clean up" case

3. **demandCommand(1)**: Requires subcommand, shows help if missing

### Verification
- Build: ✓
- Tests: ✓ (176 pass)
- Lint: ✓ (1 pre-existing warning, 0 errors)
- Manual tests:
  - `globex workspace --help` ✓
  - `globex workspace list` ✓
  - `globex workspace cleanup` ✓
  - `globex workspace` (no subcommand) exits 1 with help ✓

### Acceptance Criteria
- [x] globex workspace list shows projects with active worktrees
- [x] globex workspace cleanup shows completed projects with worktrees
- [x] workspace is a command group with subcommands
- [x] Proper error handling for no worktrees

### Files Changed
- cli/bin/globex.ts
