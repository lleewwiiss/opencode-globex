---
name: globex-status
description: Shows current Globex project status including phase, approvals, and artifacts. Use anytime to check workflow progress.
---

# Check Status

Shows current globex workflow state.

## Tools

- `globex_status` - get full status

## Execution

```
globex_status()
```

Present results:

```
Project: [name]
Phase: [current phase]
Created: [date]

Approvals:
  research: [status]
  plan: [status]
  features: [status]

Artifacts:
  [list of saved files]

Next step: [appropriate command based on phase]
```

## Phase Flow

```
init → research → interview → plan → interview → features → interview → execute → complete
```
