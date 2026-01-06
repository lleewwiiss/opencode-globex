---
name: globex-interview
description: Validates phase artifacts through adversarial questioning. Challenges both agent claims and human assumptions, requiring file:line evidence. Use after research, plan, or features phases complete.
---

# Validation Interview

Validates artifacts through structured questioning before proceeding.

## Tools

- `globex_status` - get current phase
- `globex_verify_citation` - verify file:line references
- `globex_check_convergence` - track progress toward completion
- `globex_approve_phase` - record final decision

## Interview Checklist

Copy and track:
```
Interview Progress:
- [ ] Load artifact for current phase
- [ ] Generate initial questions from findings
- [ ] Challenge claims requiring evidence
- [ ] Verify citations provided
- [ ] Check convergence
- [ ] Record approval decision
```

## Execution

### 1. Determine Phase

```
globex_status()
```

Load corresponding artifact:
- `research` → `.globex/research.md`
- `plan` → `.globex/plan.md`  
- `features` → `.globex/features.json`

### 2. Generate Questions

Questions must reference SPECIFIC findings from the artifact:

**Wrong**: "What consistency model is used?"

**Right**: "You found a 4-step write path at `api/orders.ts:45-67`. What happens if step 3 succeeds but step 4 fails? Show me the error handling."

Apply these lenses:
- **Data consistency**: What happens on partial failure?
- **Coupling**: What's the blast radius of a change here?
- **Testability**: How would you test this before implementing?
- **Failure modes**: What's the fallback if X fails?

### 3. Challenge Loop

For each user response:

**If claim made without evidence**:
> "Show me where. I need a file:line reference."

**If evidence provided**:
```
globex_verify_citation(
  filePath: "src/auth.ts",
  lineStart: 45,
  lineEnd: 67
)
```

**If uncertain/unverifiable**:
Mark as risk for tracking.

### 4. Check Convergence

After each round:
```
globex_check_convergence(
  phase: "research",
  questionsThisRound: 3,
  newGapsFound: true
)
```

Stop when:
- `shouldStop: true` returned, OR
- User indicates ready

### 5. Record Decision

Present options:
- **approved** - artifact is solid, proceed
- **approved_with_risks** - proceed but track concerns
- **rejected** - redo the phase

```
globex_approve_phase(
  phase: "research",
  status: "approved_with_risks",
  risks: ["Auth module flow not fully traced"],
  notes: "Verify auth handling during implementation"
)
```

## Convergence Limits

| Phase | Max Questions | Timebox |
|-------|---------------|---------|
| research | 25 | 20 min |
| plan | 30 | 30 min |
| features | 20 | 15 min |
