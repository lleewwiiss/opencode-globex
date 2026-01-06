---
name: globex-research
description: Conducts deep codebase research for PRD generation. Documents architecture, data flow, patterns, and integration points AS THEY EXIST without suggesting improvements. Use when starting a new globex workflow after /globex-init.
---

# Research Codebase

Documents the codebase as-is to inform implementation planning.

## Critical Constraint

**Document only. Do not suggest improvements, identify problems, or propose changes.**

Your job is to create a technical map of what exists, where it exists, and how components interact.

## Tools

- `globex_status` - verify phase is `init` or `research`
- `globex_save_artifact` - save research.md and research.citations.json

## Execution

### 1. Verify State
```
globex_status()
```
Proceed only if phase is `init` or `research`.

### 2. Spawn Parallel Research Agents

Fire these simultaneously (do not wait between them):

```
background_task(agent="explore", prompt="Find main entry points, frameworks, project structure. Return file paths with descriptions.")
background_task(agent="explore", prompt="Find database connections, API endpoints, data models. Include file:line references.")
background_task(agent="explore", prompt="Find design patterns, state management, error handling conventions.")
background_task(agent="explore", prompt="Find test files, testing patterns, test coverage approach.")
```

### 3. Synthesize Findings

Wait for all agents. Create research.md following this structure:

```markdown
# Research: [project name]

## Executive Summary
[2-3 sentences describing what the system does and how]

## Architecture
[Overview with mermaid diagram if helpful]

### Entry Points
- `path/to/file.ts:line` - description

### Key Modules
- Module name: purpose, location

## Data Flow
[How data moves through the system]

### Read Paths
### Write Paths
### Storage

## Patterns & Conventions
[Existing patterns - describe, don't evaluate]

### State Management
### Error Handling  
### Testing Approach

## Integration Points
[External services, APIs, auth]

## Risks & Unknowns
[Areas with incomplete understanding - be specific]

## Questions for Interview
[Specific questions requiring human clarification]
```

### 4. Create Citations

Every claim needs evidence. Create research.citations.json:

```json
{
  "citations": [
    {
      "claim": "Auth middleware validates JWT tokens",
      "path": "src/middleware/auth.ts",
      "lineStart": 45,
      "lineEnd": 67,
      "confidence": "verified"
    }
  ]
}
```

Confidence levels:
- `verified` - directly observed in code
- `inferred` - deduced from patterns/naming

### 5. Save and Transition

```
globex_save_artifact(name: "research.md", content: "...")
globex_save_artifact(name: "research.citations.json", content: "...")
```

Tell user: "Research complete. Run `/globex-interview` to validate findings before planning."
