---
name: globex-init
description: Initializes a new Globex PRD workflow. Creates .globex/state.json with project metadata. Use to start a new feature or bug fix workflow.
---

# Initialize Globex

Creates a new globex workflow for a feature or task.

## Tools

- `globex_init` - create state file
- `globex_status` - verify creation

## Execution

### 1. Parse Input

Extract from user's description:
- **Project name**: Short identifier (kebab-case)
- **Description**: Full description of what to build

### 2. Initialize

```
globex_init(
  projectName: "dark-mode-toggle",
  description: "Add dark mode toggle to settings page with system preference detection"
)
```

### 3. Confirm

If successful, tell user:

```
Globex initialized: [project-name]

Workflow:
1. /globex-research - explore codebase
2. /globex-interview - validate research
3. /globex-plan - create implementation plan
4. /globex-interview - validate plan
5. /globex-features - generate feature list
6. /globex-interview - validate features
7. /globex-run - implement features

Next step: Run /globex-research to explore the codebase.
```

### 4. Handle Existing Project

If project already exists:

```
Globex project already exists at .globex/

Current state:
[show globex_status output]

To start fresh, delete .globex/ directory first.
```
