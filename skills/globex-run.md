---
name: globex-run
description: Executes ONE iteration of the Ralph loop. Reads fresh state, picks one feature, implements, verifies, commits, exits. Designed for stateless external loop execution via scripts/ralph-loop.sh.
---

# Ralph Loop Iteration

Executes a single, stateless iteration. External loop calls this repeatedly until completion.

## Philosophy

From Geoffrey Huntley's Ralph: "Deterministically bad means failures are predictable and informative."

- **Stateless**: Each invocation reads fresh state from files
- **Atomic**: ONE feature per iteration
- **Clean exit**: Leave codebase in committable state
- **Erecting signs**: Write learnings for future iterations

## Tools

- `globex_status` - verify phase is `execute`
- `globex_get_next_feature` - pick next eligible feature
- `globex_update_feature` - mark feature complete
- `globex_update_progress` - update progress.md, add learnings, track iteration

## Getting Up to Speed (MANDATORY)

Every iteration starts fresh. Before ANY implementation:

```
1. globex_status()              → Verify execute phase
2. Read .globex/progress.md     → What happened, what's blocked, LEARNINGS
3. Read .globex/features.json   → Current feature states
4. git log --oneline -10        → Recent commits
5. Run health check             → Build passes? Tests pass?
```

If health check fails, fix FIRST before picking new feature.

## Single Iteration Flow

```
┌─────────────────────────────────────────────┐
│  1. GET UP TO SPEED (read state fresh)      │
├─────────────────────────────────────────────┤
│  2. HEALTH CHECK (build/test)               │
│     └─ If broken → fix first, commit, exit  │
├─────────────────────────────────────────────┤
│  3. PICK ONE FEATURE                        │
│     └─ globex_get_next_feature()            │
│     └─ If done → output completion promise  │
├─────────────────────────────────────────────┤
│  4. IMPLEMENT (one feature only)            │
│     └─ Follow existing patterns             │
│     └─ Run lsp_diagnostics                  │
├─────────────────────────────────────────────┤
│  5. VERIFY                                  │
│     └─ Automated checks from feature        │
│     └─ If fail → fix and re-verify          │
├─────────────────────────────────────────────┤
│  6. MANUAL VERIFICATION PAUSE               │
│     └─ STOP and wait for human              │
├─────────────────────────────────────────────┤
│  7. COMMIT & UPDATE                         │
│     └─ git commit (never push)              │
│     └─ Mark feature complete                │
│     └─ Update progress.md                   │
├─────────────────────────────────────────────┤
│  8. EXIT (loop will restart fresh)          │
└─────────────────────────────────────────────┘
```

## Execution

### 1. Get Up to Speed

```
globex_status()
```

Read `.globex/progress.md` - pay attention to:
- Current iteration number
- Learnings from previous iterations
- Blocked features and why

Read `.globex/features.json` - understand scope.

```bash
git log --oneline -10
```

### 2. Health Check

Run project's build and test commands:

```bash
# Example - adapt to project
npm run build
npm test
```

If either fails:
1. Fix the issue
2. Commit the fix: `git commit -m "fix: [what broke]"`
3. Add learning: `globex_update_progress(learning: "Build requires X before Y")`
4. Exit - loop will restart fresh

### 3. Pick One Feature

```
result = globex_get_next_feature()
```

**If `result.done: true`:**
```
<promise>ALL_FEATURES_COMPLETE</promise>

Ralph loop complete. All features implemented and verified.
```

**If `result.blocked: true`:**
Report blocked features and exit. Human intervention needed.

**Otherwise:**
```
globex_update_progress(currentFeatureId: result.feature.id)
```

### 4. Implement Feature

For each file in `feature.filesTouched`:
1. Read the file completely
2. Implement changes following existing patterns
3. Run `lsp_diagnostics` after each file

CRITICAL: Do NOT try to do more than this one feature.

### 5. Verify

Run all checks from `feature.verification.automated`:

```bash
# Examples
npm run build
npm test
curl -X GET localhost:3000/api/health
```

If any fail:
1. Fix the issue
2. Re-verify
3. If stuck after 3 attempts, add to blocked and exit

### 6. Manual Verification Pause

**STOP. Do not proceed without human confirmation.**

```
Feature [ID] automated verification complete.

Manual verification required:
- [ ] [Check 1 from feature.verification.manual]
- [ ] [Check 2 from feature.verification.manual]

Reply "done" when verified, or describe issues.
```

### 7. Commit & Update

After human confirms:

```
globex_update_feature(featureId: feature.id, passes: true)
```

```bash
git add .
git commit -m "feat(globex): [feature.id] - [feature.description]"
```

If you learned something operational, erect a sign:
```
globex_update_progress(
  currentFeatureId: null,
  incrementIteration: true,
  learning: "Run migrations before seeding test data"
)
```

### 8. Exit

Exit cleanly. The external loop will restart with fresh context.

```
Iteration [N] complete. Feature [ID] implemented and committed.
Exiting for fresh context.
```

## Erecting Signs

When you discover operational knowledge, save it:

```
globex_update_progress(learning: "...")
```

Good learnings:
- Build commands that work
- Order of operations that matter
- Environment setup gotchas
- Test data requirements

Bad learnings:
- Obvious things
- Feature-specific details (those go in the commit)

## Completion Promise

When all features are done, output exactly:

```
<promise>ALL_FEATURES_COMPLETE</promise>
```

This signals the external loop to stop.

## Running the Loop

Use the external loop script:

```bash
./scripts/ralph-loop.sh --max-iterations 50
```

Or manually:
```bash
while true; do
  opencode run "/globex-run"
  if grep -q "ALL_FEATURES_COMPLETE" /tmp/last-output; then
    break
  fi
done
```
