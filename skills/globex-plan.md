---
name: globex-plan
description: Creates detailed implementation plans from approved research. Breaks work into phases with automated and manual success criteria. Use after research is approved via /globex-interview.
---

# Create Implementation Plan

Creates actionable implementation plan from approved research.

## Critical Constraint

**No open questions in the final plan.** If you encounter unknowns, stop and resolve them before writing the plan. The plan must be complete and actionable.

## Tools

- `globex_status` - verify phase is `plan`
- `globex_save_artifact` - save plan.md and plan.risks.json

## Execution

### 1. Verify State and Load Research

```
globex_status()
```

Read `.globex/research.md` completely. Understand:
- Current architecture
- Existing patterns to follow
- Identified risks

### 2. Draft Plan Structure

Present to user before writing details:

```
Proposed phases:
1. [Phase name] - [what it accomplishes]
2. [Phase name] - [what it accomplishes]

Does this structure make sense before I detail it?
```

### 3. Write Plan

Use this template (save to `.globex/plan.md`):

```markdown
# Plan: [Feature Name]

## Overview
[1-2 sentences: what we're building and why]

## Current State
[Brief summary from research - what exists now]

## Desired End State
[Specific, verifiable description of completion]

## What We're NOT Doing
[Explicit scope boundaries to prevent creep]

## Phase 1: [Name]

### Overview
[What this phase accomplishes]

### Changes Required

**File**: `path/to/file.ext`
**Changes**: [Summary]
```[language]
// Specific code changes
```

### Success Criteria

#### Automated Verification
- [ ] `make build` passes
- [ ] `make test` passes
- [ ] `make lint` passes
- [ ] New endpoint returns 200: `curl localhost:3000/api/new`

#### Manual Verification
- [ ] Feature visible in UI at /path
- [ ] Edge case X handled correctly
- [ ] Performance acceptable with N items

**After automated verification passes, PAUSE for human to complete manual verification before proceeding to Phase 2.**

---

## Phase 2: [Name]
[Same structure...]

---

## Risks

| Risk | Likelihood | Impact | Mitigation | Verification |
|------|------------|--------|------------|--------------|
| [Risk] | low/med/high | low/med/high | [Strategy] | [How to verify] |

## References
- Research: `.globex/research.md`
- Citations: `.globex/research.citations.json`
```

### 4. Create Risks JSON

```json
{
  "risks": [
    {
      "id": "R001",
      "description": "Cache invalidation race condition",
      "likelihood": "medium",
      "impact": "high", 
      "mitigation": "Use distributed lock",
      "verification": "Load test with concurrent writes"
    }
  ]
}
```

### 5. Save Artifacts

```
globex_save_artifact(name: "plan.md", content: "...")
globex_save_artifact(name: "plan.risks.json", content: "...")
```

Tell user: "Plan complete. Run `/globex-interview` to validate before generating features."

## Key Principles

- **Risky work early**: Fail fast on uncertain parts
- **Phases are checkpoints**: Each phase should be independently verifiable
- **Automated before manual**: Run all automated checks before asking for human testing
- **Explicit success criteria**: If you can't describe how to verify it, it's not done
