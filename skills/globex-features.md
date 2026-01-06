---
name: globex-features
description: Generates atomic feature list from approved plan. Each feature has clear acceptance criteria and verification method. Use after plan is approved via /globex-interview.
---

# Generate Features

Expands approved plan into atomic, implementable features for Ralph loop execution.

## Tools

- `globex_status` - verify phase is `features`
- `globex_save_artifact` - save features.json

## Context-Aware Sizing (CRITICAL)

Each feature must fit within ~50% of agent context window to ensure:
- Fresh context each iteration (stateless loop)
- Room for file reads, tool outputs, reasoning
- No context exhaustion mid-implementation

### Size Constraints

| Constraint | Limit | Rationale |
|------------|-------|-----------|
| Estimated time | 30-60 min | Completable in single iteration |
| Files touched | 10-20 max | Readable within context |
| Lines changed | ~500 max | Reviewable diff |
| Dependencies | 0-2 other features | Minimal blocking |

### When to Split

If a feature exceeds limits, split into:
1. **Setup** - infrastructure, types, scaffolding
2. **Core** - main implementation
3. **Polish** - edge cases, error handling, tests

Example: "Add user authentication" becomes:
- `F001` Setup auth types and middleware scaffold
- `F002` Implement login/logout endpoints
- `F003` Add password reset flow
- `F004` Add auth tests and error handling

## Feature Requirements

Each feature must be:
- **Atomic**: One clear deliverable
- **Isolated**: Minimal external dependencies
- **Stateless-friendly**: Can be picked up fresh by any iteration
- **Self-verifying**: Automated checks that pass/fail clearly
- **Sized**: Completable in 30-60 minutes (see constraints above)

## Execution

### 1. Verify State and Load Plan

```
globex_status()
```

Read `.globex/plan.md` completely.

### 2. Generate Features

For each phase/task in the plan, create features. Apply size constraints - split if needed.

```json
{
  "id": "F001",
  "description": "Add user avatar upload endpoint",
  "category": "functional",
  "acceptanceCriteria": [
    "POST /api/avatar accepts image file",
    "Returns 400 for non-image files",
    "Stores in configured storage backend",
    "Returns URL of uploaded avatar"
  ],
  "verification": {
    "automated": [
      "curl -X POST -F 'file=@test.png' localhost:3000/api/avatar returns 200",
      "curl -X POST -F 'file=@test.txt' localhost:3000/api/avatar returns 400"
    ],
    "manual": [
      "Upload via UI shows preview",
      "Avatar appears in profile after upload"
    ]
  },
  "passes": false,
  "priority": 1,
  "dependencies": [],
  "filesTouched": ["src/api/avatar.ts", "src/storage/index.ts"],
  "estimatedMinutes": 45,
  "sizeCheck": {
    "filesCount": 2,
    "estimatedLinesChanged": 150,
    "withinLimits": true
  }
}
```

### Categories

- `infrastructure` - setup, config, scaffolding (do first)
- `functional` - user-facing features
- `refactor` - code improvements
- `test` - test coverage additions

### 3. Validate Feature List

Before saving, verify:
- [ ] No circular dependencies
- [ ] All acceptance criteria are testable
- [ ] Priority reflects dependency order
- [ ] Infrastructure features come first
- [ ] Estimates are realistic (30-60 min each)
- [ ] Each feature touches ≤20 files
- [ ] Each feature changes ≤500 lines estimated
- [ ] Features too large have been split

### 4. Save Artifact

```json
{
  "features": [...],
  "summary": {
    "total": 12,
    "byCategory": {
      "infrastructure": 2,
      "functional": 8,
      "refactor": 1,
      "test": 1
    },
    "estimatedTotalMinutes": 540
  }
}
```

```
globex_save_artifact(name: "features.json", content: "...")
```

Tell user: "Features generated. Run `/globex-interview` to validate before execution."
