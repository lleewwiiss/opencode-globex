# Parallel Projects & Git Isolation

Design doc for running multiple Globex projects concurrently with proper git hygiene.

## Problem

Users want to work on multiple features simultaneously:
- Start "Add OAuth" project, reaches execute phase
- Urgent request comes in for "Fix payment bug"
- Currently: must wait or abandon first project

## Solution: Automatic Worktree Management

Globex handles git worktrees transparently. User thinks in "projects", not git primitives.

## Architecture

### Directory Structure

```
~/.globex/
├── workspaces/                    # Hidden worktrees (code isolation)
│   ├── <project-id-1>/           # Worktree for project 1
│   │   ├── .git                  # Worktree git link
│   │   └── <repo files>          # Checked out code
│   └── <project-id-2>/           # Worktree for project 2
│       └── ...
│
<repo>/.globex/
├── projects/                      # All project state (centralized)
│   ├── <project-id-1>/
│   │   ├── state.json            # GlobexState
│   │   ├── research.md
│   │   ├── plan.md
│   │   ├── features.json
│   │   └── progress.md
│   └── <project-id-2>/
│       └── ...
└── worktree-setup.json           # Init script for new worktrees
```

### Key Design Decisions

1. **Worktrees live in `~/.globex/workspaces/`** - Not in repo, no FS pollution
2. **Artifacts stay in repo's `.globex/projects/`** - Centralized, can be committed
3. **1:1 mapping** - Each project gets one worktree during execute phase
4. **Worktrees created lazily** - Only when entering execute phase (not during research/plan)

## Workflow

### Starting a New Project

```bash
# User runs from repo root (always)
globex init "Add OAuth support"
```

**Phases without worktree (research → plan → features):**
- Work happens in current directory
- Artifacts written to `.globex/projects/<id>/`
- No code changes yet, so no isolation needed

**Execute phase triggers worktree creation:**
```
? Ready to execute. This will create an isolated workspace.
  ❯ Continue (creates worktree at ~/.globex/workspaces/<id>/)
    Stay in current directory (not recommended for parallel work)
```

### Parallel Project Detection

```bash
# User tries to start second project while first is active
globex init "Fix payment bug"

? You have an active project:
  • "Add OAuth support" (execute phase)

  ❯ Switch to it
    Start new project alongside (isolated workspace)
    Abandon current project
```

If "alongside" is chosen:
- New worktree created for new project
- Both run independently
- User can switch between them

### Switching Projects

```bash
globex status

# Output:
PROJECTS                        PHASE       WORKSPACE
────────────────────────────────────────────────────────────
oauth-support                   execute     ~/.globex/workspaces/abc123/
payment-fix                     plan        (current directory)
legacy-cleanup                  complete    -

globex switch oauth-support
# Opens new terminal in that worktree, or shows path
```

### Completion & Merge

When project hits `complete` phase:

```
✓ Project "Add OAuth support" complete!

? How would you like to apply changes?
  ❯ Create PR from branch
    Merge to current branch
    Keep worktree (manual merge later)
    Discard changes
```

**Create PR:** Push branch, open PR via GitHub CLI/API
**Merge:** `git merge` changes into main working tree
**Keep:** Leave worktree, user handles manually
**Discard:** Remove worktree, delete branch

## Worktree Setup Script

`.globex/worktree-setup.json` - Runs when creating new worktree:

```json
{
  "setup": [
    "bun install",
    "cp $ROOT_PATH/.env .env",
    "bun run db:migrate"
  ],
  "setup-macos": [],
  "setup-linux": [],
  "setup-windows": []
}
```

**Environment variable:**
- `$ROOT_PATH` - Path to main working tree (for copying .env, etc.)

## State Schema Changes

### GlobexState additions

```typescript
interface GlobexState {
  // ... existing fields
  
  // New fields for workspace tracking
  workspace?: {
    type: "current" | "worktree"
    worktreePath?: string        // e.g., ~/.globex/workspaces/abc123/
    branchName?: string          // e.g., globex/oauth-support-abc123
    createdAt?: string
  }
}
```

### Project Registry

New file: `~/.globex/registry.json`

```json
{
  "projects": {
    "abc123": {
      "name": "Add OAuth support",
      "repoPath": "/Users/me/myapp",
      "phase": "execute",
      "worktreePath": "~/.globex/workspaces/abc123/",
      "branchName": "globex/oauth-support-abc123",
      "createdAt": "2025-01-08T10:00:00Z",
      "updatedAt": "2025-01-08T14:30:00Z"
    },
    "def456": {
      "name": "Fix payment bug",
      "repoPath": "/Users/me/myapp",
      "phase": "plan",
      "worktreePath": null,
      "branchName": null,
      "createdAt": "2025-01-08T15:00:00Z",
      "updatedAt": "2025-01-08T15:00:00Z"
    }
  }
}
```

## GitService Additions

```typescript
interface GitService {
  // Existing
  getHeadHash(workdir: string): Effect<string, GitError>
  getCommitsSince(workdir: string, hash: string): Effect<Commit[], GitError>
  getDiffStats(workdir: string): Effect<DiffStats, GitError>
  commitChanges(workdir: string, message: string): Effect<string, GitError>
  
  // New for worktrees
  createWorktree(repoPath: string, worktreePath: string, branchName: string): Effect<void, GitError>
  removeWorktree(worktreePath: string): Effect<void, GitError>
  listWorktrees(repoPath: string): Effect<Worktree[], GitError>
  mergeWorktree(worktreePath: string, targetBranch: string): Effect<MergeResult, GitError>
}

interface Worktree {
  path: string
  branch: string
  commit: string
  isLocked: boolean
}

interface MergeResult {
  success: boolean
  conflicts?: string[]
  commitHash?: string
}
```

## CLI Commands

```bash
# Project management
globex init "<description>"      # Start new project
globex status                    # List all projects
globex switch <project-id>       # Switch to project
globex abandon <project-id>      # Abandon and cleanup

# Worktree management (advanced)
globex workspace list            # List active worktrees
globex workspace cleanup         # Remove stale worktrees
globex workspace open <id>       # Open worktree in terminal/editor
```

## Artifact Handling

### During Execute Phase

Artifacts are written to `.globex/projects/<id>/` in the **main repo**, not the worktree:

```typescript
const artifactPath = path.join(
  mainRepoPath,           // Always main repo, not worktree
  ".globex/projects",
  projectId,
  "progress.md"
)
```

This ensures:
- Artifacts are centralized regardless of which worktree is active
- Can view progress of all projects from main repo
- Artifacts can be committed to main branch if desired

### Code Changes

Code changes happen in the worktree:
- Agent runs in `~/.globex/workspaces/<id>/`
- Commits go to project branch
- On completion, merge/PR to main

## Cleanup

### Automatic Cleanup

```typescript
const WORKTREE_CONFIG = {
  maxWorktrees: 10,              // Per repo
  maxAge: "7d",                  // Auto-remove after 7 days idle
  cleanupOnComplete: true,       // Prompt to cleanup on complete
}
```

### Manual Cleanup

```bash
globex workspace cleanup

# Output:
Found 3 stale worktrees:
  • oauth-support (completed 5 days ago)
  • payment-fix (abandoned 2 days ago)  
  • legacy-cleanup (idle 8 days)

? Remove all stale worktrees? (Y/n)
```

## Future: Docker Sandbox Integration

When Docker Sandboxes adds opencode support:

```bash
globex init "Add OAuth" --sandbox

# Creates worktree AND runs agent in Docker container
# Best of both worlds: code isolation + environment isolation
```

```json
{
  "workspace": {
    "type": "sandbox",
    "worktreePath": "~/.globex/workspaces/abc123/",
    "containerId": "globex-abc123",
    "branchName": "globex/oauth-support-abc123"
  }
}
```

## Implementation Order

1. **Phase 1:** GitService worktree methods
2. **Phase 2:** Project registry (`~/.globex/registry.json`)
3. **Phase 3:** CLI commands (`status`, `switch`, `abandon`)
4. **Phase 4:** Worktree setup script support
5. **Phase 5:** Completion merge/PR flow
6. **Phase 6:** Automatic cleanup
7. **Future:** Docker sandbox integration
