---
name: globex-run
description: Executes ONE autonomous iteration of the Ralph loop. Picks one feature, implements, verifies via CLI/tests, commits. No human intervention during loop. Designed for external loop execution.
---

# Ralph Loop Iteration

Fully autonomous. No human intervention. Human reviews commits AFTER loop completes.

## Tools

- `globex_get_next_feature` - pick next eligible feature
- `globex_update_feature` - mark feature complete
- `globex_update_progress` - track iteration, add learnings
- `globex_add_learning` - write critical discoveries to AGENTS.md

## The Loop (One Iteration)

```
READ .globex/progress.md and .globex/features.json
Pick ONE feature: passes=false, deps satisfied, highest priority
Implement following existing codebase patterns
Verify via CLI/test output (build, tests, lint)
If verify fails: fix and retry (max 3 attempts), then mark blocked
Commit: git add . && git commit -m "feat(globex): [id] - [description]"
Mark complete: globex_update_feature(featureId, passes: true)
Update progress: globex_update_progress(incrementIteration: true)
If critical operational detail learned: globex_add_learning("...")
If all features done: <promise>ALL_FEATURES_COMPLETE</promise>
NEVER GIT PUSH. ONLY COMMIT.
```

## Execution Steps

### 1. Get Bearings

```
globex_get_next_feature()
```

Read `.globex/progress.md` - check learnings from previous iterations.

Optionally, run `git log --oneline -20` to understand recent changes before implementing.

**If `done: true`:**
```
<promise>ALL_FEATURES_COMPLETE</promise>
```

**If `blocked: true`:**
Exit with blocked status. Loop will retry next iteration.

### 2. Implement Feature

For each file in `feature.filesTouched`:
1. Read file completely
2. Implement changes following existing patterns
3. Run `lsp_diagnostics` after changes

Do ONE feature only. Do not scope creep.

### 3. Verify (Automated Only)

Run automated checks:
```bash
# Adapt to project
npm run build    # or bun run build
npm test         # or bun test
npm run lint     # or equivalent
```

**If pass:** Continue to commit.

**If fail:** 
1. Fix the issue
2. Re-verify
3. After 3 failed attempts: mark feature blocked, exit

### 4. Commit

```bash
git add .
git commit -m "feat(globex): [feature.id] - [feature.description]"
```

**NEVER push.** Human reviews and pushes after loop completes.

### 5. Update State

```
globex_update_feature(featureId: feature.id, passes: true)
globex_update_progress(incrementIteration: true)
```

### 6. Erect Signs (If Learned Something)

If you discovered critical operational knowledge:

```
globex_add_learning("Run migrations before seeding: bun run db:migrate")
```

This writes to `AGENTS.md` so ALL future sessions benefit, not just this loop.

Good learnings:
- Build commands that work
- Environment setup requirements
- Order of operations that matter
- Non-obvious dependencies

Bad learnings:
- Feature-specific details (those go in commit message)
- Obvious things

### 7. Exit

Exit cleanly. External loop will restart with fresh context.

```
Iteration complete. Feature [ID] committed.
```

## Running the Ralph-Wiggum Loop

Two-agent loop with validation:

```
Ralph (implements) → Wiggum (validates) → feedback loop → next feature
```

**Flow:**
1. Ralph picks ONE feature, implements, commits, outputs `<ralph>DONE:FEATURE_ID</ralph>`
2. Wiggum validates against acceptance criteria
3. If `<wiggum>APPROVED</wiggum>` → next feature
4. If `<wiggum>REJECTED:reason</wiggum>` → Ralph retries with feedback
5. Loop continues until `<promise>ALL_FEATURES_COMPLETE</promise>`

**Quick start:**
```bash
./scripts/ralph-wiggum-loop.sh
```

**Options:**
```bash
./scripts/ralph-wiggum-loop.sh --max-iterations 50
./scripts/ralph-wiggum-loop.sh --model opencode/claude-sonnet-4
```

**Monitoring:**
```bash
tail -f .globex/ralph-wiggum.log
```

**Stop:** Ctrl+C (codebase remains in clean committed state)

## Completion

When all features pass:

```
<promise>ALL_FEATURES_COMPLETE</promise>

Ralph loop complete.
Completed: X features
Commits: Y
Review commits with: git log --oneline
```
