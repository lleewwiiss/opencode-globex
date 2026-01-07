# Reviewing opencode-maestro patterns for Globex

**Session ID:** ses_468a4995bffe7EYrNYOb7PFfU0
**Created:** 1/7/2026, 5:28:28 PM
**Updated:** 1/7/2026, 5:29:18 PM

---

## User

/globex-init I have an old agentic flow which is a bit different but I wanted to check if there is anything that we should leverage for there, it was working quite well but its very different https://github.com/lleewwiiss/opencode-maestro

---

## Assistant (Build · claude-opus-4-5 · 8.6s)

_Thinking:_

The user wants to initialize a Globex project to analyze and potentially leverage patterns from their old agentic flow at https://github.com/lleewwiiss/opencode-maestro. 

From the supermemory context, I can see:
1. There's already analysis comparing opencode-maestro with Globex
2. Key patterns identified: 10-turn limits, Coach-Player pattern, structured verdicts, gap analysis, handoff/rehydrate
3. Globex uses Effect-TS architecture

Let me first fetch the repo to understand what's there, then initialize a Globex project for this research task.

Fetching the repo to understand what patterns exist:

```
Tool: webfetch

**Input:**
```json
{
  "url": "https://github.com/lleewwiiss/opencode-maestro",
  "format": "markdown"
}
```
**Output:**
```
                    GitHub - lleewwiiss/opencode-maestro: About Structured Agentic Workflows for Sourcegraph OpenCode using beads.                                             

[Skip to content](#start-of-content)   

## Navigation Menu

Toggle navigation

[](/)

[Sign in](/login?return_to=https%3A%2F%2Fgithub.com%2Flleewwiiss%2Fopencode-maestro)

Appearance settings

  

-   Platform
    
    -   AI CODE CREATION
        
        -   [
            
            GitHub CopilotWrite better code with AI
            
            ](https://github.com/features/copilot)
        -   [
            
            GitHub SparkBuild and deploy intelligent apps
            
            ](https://github.com/features/spark)
        -   [
            
            GitHub ModelsManage and compare prompts
            
            ](https://github.com/features/models)
        -   [
            
            MCP RegistryNewIntegrate external tools
            
            ](https://github.com/mcp)
        
    -   DEVELOPER WORKFLOWS
        
        -   [
            
            ActionsAutomate any workflow
            
            ](https://github.com/features/actions)
        -   [
            
            CodespacesInstant dev environments
            
            ](https://github.com/features/codespaces)
        -   [
            
            IssuesPlan and track work
            
            ](https://github.com/features/issues)
        -   [
            
            Code ReviewManage code changes
            
            ](https://github.com/features/code-review)
        
    -   APPLICATION SECURITY
        
        -   [
            
            GitHub Advanced SecurityFind and fix vulnerabilities
            
            ](https://github.com/security/advanced-security)
        -   [
            
            Code securitySecure your code as you build
            
            ](https://github.com/security/advanced-security/code-security)
        -   [
            
            Secret protectionStop leaks before they start
            
            ](https://github.com/security/advanced-security/secret-protection)
        
    -   EXPLORE
        
        -   [Why GitHub](https://github.com/why-github)
        -   [Documentation](https://docs.github.com)
        -   [Blog](https://github.blog)
        -   [Changelog](https://github.blog/changelog)
        -   [Marketplace](https://github.com/marketplace)
        
    
    [View all features](https://github.com/features)
    
-   Solutions
    
    -   BY COMPANY SIZE
        
        -   [Enterprises](https://github.com/enterprise)
        -   [Small and medium teams](https://github.com/team)
        -   [Startups](https://github.com/enterprise/startups)
        -   [Nonprofits](https://github.com/solutions/industry/nonprofits)
        
    -   BY USE CASE
        
        -   [App Modernization](https://github.com/solutions/use-case/app-modernization)
        -   [DevSecOps](https://github.com/solutions/use-case/devsecops)
        -   [DevOps](https://github.com/solutions/use-case/devops)
        -   [CI/CD](https://github.com/solutions/use-case/ci-cd)
        -   [View all use cases](https://github.com/solutions/use-case)
        
    -   BY INDUSTRY
        
        -   [Healthcare](https://github.com/solutions/industry/healthcare)
        -   [Financial services](https://github.com/solutions/industry/financial-services)
        -   [Manufacturing](https://github.com/solutions/industry/manufacturing)
        -   [Government](https://github.com/solutions/industry/government)
        -   [View all industries](https://github.com/solutions/industry)
        
    
    [View all solutions](https://github.com/solutions)
    
-   Resources
    
    -   EXPLORE BY TOPIC
        
        -   [AI](https://github.com/resources/articles?topic=ai)
        -   [Software Development](https://github.com/resources/articles?topic=software-development)
        -   [DevOps](https://github.com/resources/articles?topic=devops)
        -   [Security](https://github.com/resources/articles?topic=security)
        -   [View all topics](https://github.com/resources/articles)
        
    -   EXPLORE BY TYPE
        
        -   [Customer stories](https://github.com/customer-stories)
        -   [Events & webinars](https://github.com/resources/events)
        -   [Ebooks & reports](https://github.com/resources/whitepapers)
        -   [Business insights](https://github.com/solutions/executive-insights)
        -   [GitHub Skills](https://skills.github.com)
        
    -   SUPPORT & SERVICES
        
        -   [Documentation](https://docs.github.com)
        -   [Customer support](https://support.github.com)
        -   [Community forum](https://github.com/orgs/community/discussions)
        -   [Trust center](https://github.com/trust-center)
        -   [Partners](https://github.com/partners)
        
    
-   Open Source
    
    -   COMMUNITY
        
        -   [
            
            GitHub SponsorsFund open source developers
            
            ](https://github.com/sponsors)
        
    -   PROGRAMS
        
        -   [Security Lab](https://securitylab.github.com)
        -   [Maintainer Community](https://maintainers.github.com)
        -   [Accelerator](https://github.com/accelerator)
        -   [Archive Program](https://archiveprogram.github.com)
        
    -   REPOSITORIES
        
        -   [Topics](https://github.com/topics)
        -   [Trending](https://github.com/trending)
        -   [Collections](https://github.com/collections)
        
    
-   Enterprise
    
    -   ENTERPRISE SOLUTIONS
        
        -   [
            
            Enterprise platformAI-powered developer platform
            
            ](https://github.com/enterprise)
        
    -   AVAILABLE ADD-ONS
        
        -   [
            
            GitHub Advanced SecurityEnterprise-grade security features
            
            ](https://github.com/security/advanced-security)
        -   [
            
            Copilot for BusinessEnterprise-grade AI features
            
            ](https://github.com/features/copilot/copilot-business)
        -   [
            
            Premium SupportEnterprise-grade 24/7 support
            
            ](https://github.com/premium-support)
        
    
-   [Pricing](https://github.com/pricing)

Search or jump to...

# Search code, repositories, users, issues, pull requests...

Search

Clear

[Search syntax tips](https://docs.github.com/search-github/github-code-search/understanding-github-code-search-syntax)

# Provide feedback

We read every piece of feedback, and take your input very seriously.

 Include my email address so I can be contacted

Cancel Submit feedback

# Saved searches

## Use saved searches to filter your results more quickly

Name  

Query 

To see all available qualifiers, see our [documentation](https://docs.github.com/search-github/github-code-search/understanding-github-code-search-syntax).

Cancel Create saved search

[Sign in](/login?return_to=https%3A%2F%2Fgithub.com%2Flleewwiiss%2Fopencode-maestro)

[Sign up](/signup?ref_cta=Sign+up&ref_loc=header+logged+out&ref_page=%2F%3Cuser-name%3E%2F%3Crepo-name%3E&source=header-repo&source_repo=lleewwiiss%2Fopencode-maestro)

Appearance settings

Resetting focus

You signed in with another tab or window. Reload to refresh your session. You signed out in another tab or window. Reload to refresh your session. You switched accounts on another tab or window. Reload to refresh your session. Dismiss alert

[lleewwiiss](/lleewwiiss) / **[opencode-maestro](/lleewwiiss/opencode-maestro)** Public

-   [Notifications](/login?return_to=%2Flleewwiiss%2Fopencode-maestro) You must be signed in to change notification settings
-   [Fork 4](/login?return_to=%2Flleewwiiss%2Fopencode-maestro)
-   [Star 32](/login?return_to=%2Flleewwiiss%2Fopencode-maestro)
    

About Structured Agentic Workflows for Sourcegraph OpenCode using beads.

[32 stars](/lleewwiiss/opencode-maestro/stargazers) [4 forks](/lleewwiiss/opencode-maestro/forks) [Branches](/lleewwiiss/opencode-maestro/branches) [Tags](/lleewwiiss/opencode-maestro/tags) [Activity](/lleewwiiss/opencode-maestro/activity)

[Star](/login?return_to=%2Flleewwiiss%2Fopencode-maestro)

[Notifications](/login?return_to=%2Flleewwiiss%2Fopencode-maestro) You must be signed in to change notification settings

-   [Code](/lleewwiiss/opencode-maestro)
-   [Issues 0](/lleewwiiss/opencode-maestro/issues)
-   [Pull requests 1](/lleewwiiss/opencode-maestro/pulls)
-   [Actions](/lleewwiiss/opencode-maestro/actions)
-   [Projects 0](/lleewwiiss/opencode-maestro/projects)
-   [Security](/lleewwiiss/opencode-maestro/security)
    
    [](/lleewwiiss/opencode-maestro/security)
    
    [](/lleewwiiss/opencode-maestro/security)
    
    [](/lleewwiiss/opencode-maestro/security)
    
    [
    
    ### Uh oh!
    
    ](/lleewwiiss/opencode-maestro/security)
    
    [There was an error while loading.](/lleewwiiss/opencode-maestro/security) Please reload this page.
    
-   [Insights](/lleewwiiss/opencode-maestro/pulse)

Additional navigation options

-   [Code](/lleewwiiss/opencode-maestro)
-   [Issues](/lleewwiiss/opencode-maestro/issues)
-   [Pull requests](/lleewwiiss/opencode-maestro/pulls)
-   [Actions](/lleewwiiss/opencode-maestro/actions)
-   [Projects](/lleewwiiss/opencode-maestro/projects)
-   [Security](/lleewwiiss/opencode-maestro/security)
-   [Insights](/lleewwiiss/opencode-maestro/pulse)

# lleewwiiss/opencode-maestro

  

 main

[Branches](/lleewwiiss/opencode-maestro/branches)[Tags](/lleewwiiss/opencode-maestro/tags)

[](/lleewwiiss/opencode-maestro/branches)[](/lleewwiiss/opencode-maestro/tags)

Go to file

Code

Open more actions menu

## Folders and files

Name

Name

Last commit message

Last commit date

## Latest commit

## History

[18 Commits](/lleewwiiss/opencode-maestro/commits/main/)

[](/lleewwiiss/opencode-maestro/commits/main/)

[templates/.opencode](/lleewwiiss/opencode-maestro/tree/main/templates/.opencode "This path skips through empty directories")

[templates/.opencode](/lleewwiiss/opencode-maestro/tree/main/templates/.opencode "This path skips through empty directories")

[AGENTIC\_WORKFLOW.md](/lleewwiiss/opencode-maestro/blob/main/AGENTIC_WORKFLOW.md "AGENTIC_WORKFLOW.md")

[AGENTIC\_WORKFLOW.md](/lleewwiiss/opencode-maestro/blob/main/AGENTIC_WORKFLOW.md "AGENTIC_WORKFLOW.md")

[README.md](/lleewwiiss/opencode-maestro/blob/main/README.md "README.md")

[README.md](/lleewwiiss/opencode-maestro/blob/main/README.md "README.md")

[install.sh](/lleewwiiss/opencode-maestro/blob/main/install.sh "install.sh")

[install.sh](/lleewwiiss/opencode-maestro/blob/main/install.sh "install.sh")

View all files

## Repository files navigation

-   [README](#)

# OpenCode Agentic Workflow

[](#opencode-agentic-workflow)

```
  __  __                 _
 |  \/  |               | |
 | \  / | __ _  ___  ___| |_ _ __ ___
 | |\/| |/ _` |/ _ \/ __| __| '__/ _ \
 | |  | | (_| |  __/\__ \ |_| | | (_) |
 |_|  |_|\__,_|\___||___/\__|_|  \___/
           OpenCode Maestro
```

A structured, high-context workflow for [OpenCode](https://opencode.ai) + [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode), aligned with:

-   [ACE-FCA](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents) (Advanced Context Engineering - Frequent Intentional Compaction)
-   [Claude 4 Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices)
-   [Block's Dialectical Autocoding](https://block.xyz/documents/adversarial-cooperation-in-code-synthesis.pdf) (Coach-Player adversarial cooperation)

It utilizes **Beads** (Issue Tracking), **Git Worktrees**, and **oh-my-opencode** (multi-model agents) to manage agent context and isolation.

## Philosophy

[](#philosophy)

This workflow implements the **"Frequent Intentional Compaction"** methodology:

> "A bad line of code is a bad line of code. But a bad line of a **plan** could lead to hundreds of bad lines of code. And a bad line of **research** could land you with thousands of bad lines of code."

### Core Principles

[](#core-principles)

1.  **Human as Orchestrator** - You drive; agents execute
2.  **Frequent Intentional Compaction** - Each phase is fresh context (subtask)
3.  **Artifacts over Memory** - Persist to `.beads/artifacts/` (specs, research, plans)
4.  **High-Leverage Human Review** - Review research and plans, not just code
5.  **Research → Plan → Implement** - Mandatory sequence
6.  **Context Quality** - Correctness > completeness > noise; compact early and keep context utilization ~40–60%

### OpenCode Defaults (Use These)

[](#opencode-defaults-use-these)

-   Run OpenCode `/init` per repo to generate `AGENTS.md` (commit it).
-   Use the built-in Plan agent (Tab) for `/research` + `/plan`.
-   Use the built-in Build agent (Tab) for `/implement` + `/finish`.
-   Use `/undo` + `/redo` whenever a prompt goes sideways.
-   Use `/compact` to reduce chat noise; use `/handoff` + `/rehydrate` for bead continuity across sessions.
-   Use `/sessions` (OpenCode’s built-in `/resume` alias) to navigate between parent and subagent sessions.
-   Avoid overriding built-in commands (hence `/rehydrate`, not a custom `/resume`).

graph TD
    classDef default fill:#1e1e1e,stroke:#333,stroke-width:2px,color:#fff;
    classDef bead fill:#d97706,stroke:#b45309,stroke-width:2px,color:#fff;
    classDef git fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#fff;
    classDef agent fill:#7c3aed,stroke:#6d28d9,stroke-width:2px,color:#fff;
    classDef coach fill:#dc2626,stroke:#b91c1c,stroke-width:2px,color:#fff;

    New(\[User Input\]) --> Create
    
    subgraph "1. Create & Start"
        Create\["/create"\]:::bead
        Start\["/start"\]:::bead
        Scout\["/scout"\]:::agent
    end

    subgraph "2. Research & Plan"
        Research\["/research"\]:::agent
        Plan\["/plan"\]:::agent
    end

    subgraph "3. Implement"
        Implement\["/implement"\]:::agent
        Coach\["/coach"\]:::coach
    end
    
    subgraph "4. Ship"
        Finish\["/finish"\]:::git
    end

    subgraph "Session Continuity"
        Handoff\["/handoff"\]:::agent
        Resume\["/rehydrate"\]:::agent
    end

    Create --> Start
    Start --> Scout
    Scout -.-> Research
    Start --> Research
    Research --> Plan
    Plan --> Implement
    Implement --> Coach
    Coach --> Implement
    Coach --> Finish
    Implement -.-> Handoff
    Handoff -.-> Resume
    Resume -.-> Implement

Loading

## The 10-Command Workflow

[](#the-10-command-workflow)

```
/create                   →  Interview → bead + spec.md (uses templates)
      ↓
/start [bead-id]          →  bd ready → setup workspace → explore → exploration-context.md
      ↓
/scout <target>           →  Quick async exploration (fire-and-forget, optional)
      ↓
/research <bead-id>       →  INTERACTIVE: Explore → present findings → iterate → research.md
      │                       (back-and-forth conversation IS the review)
      ↓
/plan <bead-id>           →  INTERACTIVE: Generate → walk through phases → iterate → plan.md
      │                       (iterate IN the conversation until approved, child beads created after)
      ↓
/implement <bead-id>      →  Execute plan with coach checkpoints (max 10 turns/phase)
      │                       ↓
      │                   /coach <bead-id>  →  Adversarial validation against spec.md
      │                       ↓
      │                   [Coach APPROVED?] → Continue / Address feedback
      ↓
   [Tests + Lint + Coach MUST pass] ← HARD GATE
      ↓
/finish <bead-id>         →  Coach review → commit + close

Session Continuity (use anytime):
──────────────────────────────────
/handoff                  →  Create handoff document (context approaching limit)
/rehydrate                →  Resume from latest handoff (new session)
```

### Always-Interactive Research & Planning

[](#always-interactive-research--planning)

Both `/research` and `/plan` are **always interactive**. The conversation IS the review:

Phase

What Happens

**Research**

Agent explores → presents findings → you discuss → agent digs deeper or pivots → iterate until you approve

**Plan**

Agent generates → presents approach → walks through phases (depth based on risk) → you discuss → iterate until you approve → child beads created

**Key behaviors:**

-   Agent uses judgment to determine engagement depth (auth changes = more detail, UI tweaks = faster)
-   Agent will push back if your feedback seems incorrect (with evidence)
-   Agent flags uncertainties explicitly rather than hiding them
-   Child beads created ONLY after plan is finalized (not during)

This prevents "rubber-stamping" - you can't just type "approve" without engaging.

### Completion Gates (Non-Negotiable)

[](#completion-gates-non-negotiable)

A bead **CANNOT** be marked complete until:

-   Build passes
-   **ALL** tests pass (existing + new)
-   Lint passes (if present)
-   All tests specified in plan's "Testing Strategy" are written

## The Stack

[](#the-stack)

-   **[OpenCode](https://opencode.ai)**: The AI Coding Agent
-   **[oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)**: Multi-model agent orchestration plugin
-   **[Beads (bd)](https://github.com/steveyegge/beads)**: Lightweight, CLI-first issue tracking that lives in git
-   **[HumanLayer](https://github.com/humanlayer/humanlayer)**: Creators of the ACE-FCA methodology

## Design Decisions

[](#design-decisions)

### Why Beads (vs Pure Git)

[](#why-beads-vs-pure-git)

We evaluated using pure git (branches + plan.md phases) but chose Beads for:

Feature

Pure Git

Beads

**Dependency tracking**

None

`blocks`, `related`, `parent-child`, `discovered-from`

**Ready work detection**

Manual

`bd ready` instantly shows unblocked work

**Multi-agent coordination**

Branch conflicts

Hash-based IDs prevent collisions

**Hierarchical work breakdown**

Manual in plan.md

`bd-xxx.1`, `bd-xxx.2` native support

**Discovered work linking**

Manual notes

`discovered-from` auto-links to parent

**Memory decay**

Manual cleanup

Automatic compaction of old issues

**Bottom line:** Beads provides dependency-aware issue tracking that git alone cannot replicate.

### Why Commands (vs Skills)

[](#why-commands-vs-skills)

We evaluated Claude Code Skills (model-invoked SKILL.md files) but chose OpenCode commands for:

Aspect

Skills

Commands

**Invocation**

Model-invoked (Claude decides)

User-invoked (`/research`)

**Workflow control**

Claude might skip steps

You control the sequence

**ACE-FCA alignment**

Weaker - agent might bypass

Perfect - "human as orchestrator"

**Review points**

Implicit

Explicit - you run each command

**Bottom line:** ACE-FCA emphasizes "human as orchestrator" - explicit commands ensure the Research -> Plan -> Implement sequence is followed. Skills would allow Claude to rationalize skipping steps.

### Artifact Files

[](#artifact-files)

**Decision:** Artifacts are working files, not permanent documentation. Delete after PR merge.

Artifact

During Work

After PR Merge

`spec.md`

`.beads/artifacts/<bead-id>/`

Bead metadata suffices

`research.md`

`.beads/artifacts/<bead-id>/`

Delete

`plan.md`

`.beads/artifacts/<bead-id>/`

Delete

`review.md`

`.beads/artifacts/<bead-id>/`

Delete

`handoffs/`

`.beads/artifacts/<bead-id>/`

Delete

**Rationale:**

-   Artifacts exist to guide implementation, not as permanent documentation
-   PR description captures the "why" for posterity
-   Git history has the "what" (the actual changes)
-   Keeping stale artifacts creates confusion

## Installation

[](#installation)

### Prerequisites

[](#prerequisites)

1.  **[OpenCode](https://opencode.ai)**: Install OpenCode first
2.  **[oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)** (recommended): Multi-model agent orchestration
    -   Add `"oh-my-opencode"` to the `plugin` array in `~/.config/opencode/opencode.json`
    -   Follow the oh-my-opencode README for model authentication setup

### Install Workflow Commands

[](#install-workflow-commands)

# Local install (current project only)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/lleewwiiss/opencode-maestro/main/install.sh)"

# Global install (~/.config/opencode/)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/lleewwiiss/opencode-maestro/main/install.sh)" -- -g

## What it installs

[](#what-it-installs)

### Slash Commands (`.opencode/command/`)

[](#slash-commands-opencodecommand)

Command

Purpose

`/create`

Interview → bead + spec.md

`/start [bead-id]`

Find/setup bead, load context

`/scout <target>`

Quick async exploration (fire-and-forget)

`/research <bead-id>`

**Interactive:** explore → present → iterate → research.md

`/plan <bead-id>`

**Interactive:** generate → walk through → iterate until approved → plan.md + child beads

`/implement <bead-id>`

Execute plan with coach checkpoints

`/coach <bead-id>`

Adversarial validation against spec.md

`/finish [bead-id]`

Coach review → commit + sync + push

`/handoff`

Create handoff for session continuity

`/rehydrate`

Resume from latest handoff

### Subagents (`.opencode/agent/`)

[](#subagents-opencodeagent)

Agent

Purpose

`codebase-analyzer`

Deep code understanding with file:line refs (LSP-enabled)

`codebase-pattern-finder`

Find similar implementations (AST-grep enabled)

**Note:** oh-my-opencode provides additional agents: `explore`, `librarian`, `oracle`, `frontend-ui-ux-engineer`, `document-writer`, `multimodal-looker`

### Protocols

[](#protocols)

-   `AGENTIC_WORKFLOW.md`: The master protocol document

## Usage

[](#usage)

1.  **Start**: `opencode`
2.  **Initialize (once per repo)**: `/init` → review + commit `AGENTS.md`
3.  **Create Work**: `/create` (interview → bead + spec)
4.  **Pick Work**: `/start` (or `/start bd-xxx` for specific bead)
5.  **Deep Work**: The agent guides you through `/research` → `/plan` → `/implement`
6.  **Ship**: `/finish` (commits, syncs beads, pushes)

### Session Continuity

[](#session-continuity)

When context window approaches limit:

1.  Run `/handoff` to capture current state
2.  End session gracefully
3.  Start new session with `/rehydrate`
4.  Continue work seamlessly from handoff

## Human Review Points

[](#human-review-points)

After

Review

Why

`/create`

`spec.md`

Ensure problem is well-defined

`/research`

**Interactive dialogue**

Bad research = bad plan = bad code. The conversation IS the review.

`/plan`

**Interactive dialogue**

Approve approach AND each phase before implementation. Child beads created after.

`/finish`

Commits + PR

Final validation

**Note:** `/research` and `/plan` no longer produce artifacts for passive review. You engage directly with the agent, iterate, and only proceed when satisfied.

## Artifacts

[](#artifacts)

Artifacts are **local-only working files** - never committed to git. The `/start` command auto-adds `.beads/artifacts/` to `.gitignore`.

**Why local-only?**

-   Artifacts contain session-specific working state (research notes, draft plans, handoffs)
-   They become stale quickly and would clutter git history
-   Different developers may have different artifacts for the same bead
-   The PR description and git history are the permanent record; artifacts are ephemeral

```
.beads/
└── artifacts/           # ← In .gitignore, never committed
    └── <bead-id>/
        ├── spec.md                # Created by /create
        ├── exploration-context.md # Created by /start (seeds /research)
        ├── research.md            # Created by /research
        ├── plan.md                # Created by /plan
        ├── review.md              # Created by /finish
        └── handoffs/              # Session continuity
            └── YYYY-MM-DD_HH-MM-SS_handoff.md
```

## About

About Structured Agentic Workflows for Sourcegraph OpenCode using beads.

### Resources

[Readme](#readme-ov-file)

### Uh oh!

There was an error while loading. Please reload this page.

[Activity](/lleewwiiss/opencode-maestro/activity)

### Stars

[**32** stars](/lleewwiiss/opencode-maestro/stargazers)

### Watchers

[**0** watching](/lleewwiiss/opencode-maestro/watchers)

### Forks

[**4** forks](/lleewwiiss/opencode-maestro/forks)

[Report repository](/contact/report-content?content_url=https%3A%2F%2Fgithub.com%2Flleewwiiss%2Fopencode-maestro&report=lleewwiiss+%28user%29)

## [Releases](/lleewwiiss/opencode-maestro/releases)

No releases published

## [Packages 0](/users/lleewwiiss/packages?repo_name=opencode-maestro)

No packages published  

## Languages

-   [Shell 100.0%](/lleewwiiss/opencode-maestro/search?l=shell)

## Footer

[](https://github.com)© 2026 GitHub, Inc.

### Footer navigation

-   [Terms](https://docs.github.com/site-policy/github-terms/github-terms-of-service)
-   [Privacy](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement)
-   [Security](https://github.com/security)
-   [Status](https://www.githubstatus.com/)
-   [Community](https://github.community/)
-   [Docs](https://docs.github.com/)
-   [Contact](https://support.github.com?tags=dotcom-footer)
-   Manage cookies
-   Do not share my personal information

You can’t perform that action at this time.
```
```

---

## Assistant (Build · claude-opus-4-5 · 6.7s)

_Thinking:_

Good, I got the README. Let me now fetch the key files to understand the actual implementation - especially the AGENTIC_WORKFLOW.md and some command files.

```
Tool: webfetch

**Input:**
```json
{
  "url": "https://raw.githubusercontent.com/lleewwiiss/opencode-maestro/main/AGENTIC_WORKFLOW.md",
  "format": "text"
}
```
**Output:**
```
# Agentic Workflow Protocol

Aligned with:
- [ACE-FCA](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents) - Frequent Intentional Compaction
- [Claude 4 Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices) - Explicit instructions, parallel tools, investigate before acting
- [Block's Dialectical Autocoding](https://block.xyz/documents/adversarial-cooperation-in-code-synthesis.pdf) - Coach-Player adversarial cooperation

**Tools**: Beads (bd CLI) + Git Worktrees + OpenCode + oh-my-opencode (commands + subagents)

---

## Core Principles

### ACE-FCA Principles

> "A bad line of code is a bad line of code. But a bad line of a **plan** could lead to hundreds of bad lines of code. And a bad line of **research** could land you with thousands of bad lines of code."

1. **Human as Orchestrator** - You drive; agents execute
2. **Frequent Intentional Compaction** - Each phase is fresh context (subtask)
3. **Artifacts over Memory** - Persist to `.beads/artifacts/` (specs, research, plans)
4. **High-Leverage Human Review** - Review research and plans, not just code
5. **Research → Plan → Implement** - Mandatory sequence

### Dialectical Autocoding (Block Research)

> "Discard the implementing agent's self-report of success and have the coach perform an independent evaluation."

The workflow implements a **Coach-Player** adversarial cooperation pattern:

| Role | Focus | Responsibility |
|------|-------|----------------|
| **Player** | Implementation | Write code, execute commands, respond to feedback |
| **Coach** | Validation | Verify against requirements, provide specific feedback |

**Key Insight**: Without independent coach review, implementing agents claim success while producing non-functional code. The coach anchors ALL evaluation to the original spec.md requirements.

**Turn Limits**: Maximum 10 implementation turns per phase. If coach doesn't approve within 10 turns, escalate to human.

---

## The 10-Command Workflow

```
/create                   →  Interview → bead + spec.md (uses templates)
      ↓
/start [bead-id]          →  bd ready → setup workspace → explore → exploration-context.md
      ↓
/scout <target>           →  Quick async exploration (fire-and-forget, optional)
      ↓
/research <bead-id>       →  INTERACTIVE: Explore → present findings → iterate → research.md
      │                       (back-and-forth conversation IS the review)
      ↓
/plan <bead-id>           →  INTERACTIVE: Generate → walk through phases → iterate → plan.md
      │                       (iterate IN the conversation until approved, child beads created after)
      ↓
/implement <bead-id>      →  Execute plan with coach checkpoints (max 10 turns/phase)
      │                       ↓
      │                   /coach <bead-id>  →  Adversarial validation against spec.md
      │                       ↓
      │                   [Coach APPROVED?] → Continue / Address feedback
      ↓
   [Tests + Lint + Coach MUST pass] ← HARD GATE
      ↓
/finish <bead-id>         →  Coach review → commit + close

Session Continuity (use anytime):
──────────────────────────────────
/handoff                  →  Create handoff document (context approaching limit)
/rehydrate                →  Resume from latest handoff (new session)
```

### Completion Gates (Non-Negotiable)

A bead **CANNOT** be marked complete until:
- [ ] Build passes
- [ ] **ALL** tests pass (existing + new)
- [ ] Lint passes (if present)
- [ ] All tests specified in plan's "Testing Strategy" are written
- [ ] **For parent beads**: All child beads must be closed first

---

## Interactive Refinement (Always-On)

Both `/research` and `/plan` are **always interactive**. This is not optional - it's how high-leverage review happens.

### Why Interactive?

From ACE-FCA:
> "You have to engage with your task or it WILL NOT WORK."

The back-and-forth conversation IS the review. Passive artifact review leads to rubber-stamping.

### `/research` Interactive Flow

```
1. GENERATE (subagent, fresh context)
   └→ Agent explores codebase
   └→ Writes research.md
   
2. PRESENT & DISCUSS (main context)
   └→ Agent presents key findings conversationally
   └→ "Does this match your understanding?"
   └→ Flags uncertainties: "I'm not 100% sure about X"
   └→ Chesterton's Fence: "I believe Y exists because Z. Confirm?"
   
3. ITERATE
   └→ Human: "dig deeper on X" → new subagent explores X
   └→ Human: "that's wrong" → new subagent with correction
   └→ Human: "restart" → fresh subagent, new direction
   └→ Agent may push back: "I'd push back - the code shows..."
   
4. FINALIZE
   └→ Human approves
   └→ Summary of confirmed findings
   └→ Ready for /plan
```

### `/plan` Interactive Flow

```
1. GENERATE (subagent, fresh context)
   └→ Agent reads research.md
   └→ Generates plan.md
   
2. PRESENT APPROACH
   └→ Agent presents options with tradeoffs
   └→ Risk assessment (agent judgment)
   └→ Human confirms approach
   
3. WALK THROUGH PHASES
   └→ Agent determines engagement depth per phase:
      • High-risk (auth, data): detailed walkthrough
      • Low-risk (tests, UI): summary, offer details if wanted
   └→ For each phase needing review:
      • Present changes with file:line refs
      • Chesterton's Fence checks
      • "Any concerns?"
   
4. ITERATE
   └→ Human feedback → subagent revises + cascades
   └→ Agent may push back with evidence
   └→ Human overrides noted in plan.md
   
5. FINALIZE & CREATE BEADS
   └→ Human approves final plan
   └→ Child beads created with RICH descriptions
   └→ Ready for /implement
```

### Agent Behaviors

| Behavior | Purpose |
|----------|---------|
| **Variable engagement depth** | Agent decides what needs detailed review vs summary |
| **Push back with evidence** | Agent challenges incorrect feedback |
| **Flag uncertainties** | "I believe X" ≠ "I verified X" |
| **Chesterton's Fence** | Explain WHY existing code works before proposing changes |
| **Note overrides** | If human overrides agent recommendation, document it |

### Child Bead Descriptions

Child beads are created with rich descriptions that enable standalone execution:

```markdown
## Context
[What this phase accomplishes in the larger feature]

## Key Changes
- `file1.ts` - [what changes]
- `file2.ts` - [what changes]

## Patterns to Follow
- See `similar_file:line` for [pattern]

## Success Criteria
- [ ] [Specific criterion]
- [ ] Tests pass

## References
- Full plan: `.beads/artifacts/bd-xxx/plan.md`
```

This allows an agent to work from the bead description itself, with plan.md as backup.

---

## Testing Requirements

> Tests are not optional. Every feature/fix must have corresponding tests.
> 
> Aligned with **Agile Testing** (Crispin & Gregory)

### Test Pyramid
```
      /\      E2E (few, slow)
     /──\     Integration (some)
    /────\    Unit (many, fast)
```

### Agile Testing Quadrants
- **Q1**: Unit & component tests (automated, support team)
- **Q2**: Functional & story tests (automated, support team)
- **Q3**: Exploratory & usability (manual, critique product)
- **Q4**: Performance & security (automated, critique product)

### In `/plan`
- **MANDATORY**: "Testing Strategy" section with:
  - Tests mapped to quadrants
  - New tests to write (with file paths)
  - Existing tests to update
  - Exploratory testing notes

### In `/implement`
- Tests must pass after EVERY step
- Lint must pass after EVERY step
- Follow FIRST principles (Fast, Independent, Repeatable, Self-validating, Timely)
- Test behavior, not implementation
- New tests from plan must be written

### In `/finish`
- **HARD GATE**: Build + Tests + Lint must ALL pass
- Cannot close bead if any verification fails
- Blocked beads return to `/implement`

```bash
# Verification commands (examples)
npm run build && npm test && npm run lint    # Node.js
cargo build && cargo test && cargo clippy    # Rust
go build ./... && go test ./... && golangci-lint run  # Go
pytest && ruff check                          # Python
```

---

## Code Quality Principles

Agents follow principles from:
- **The Pragmatic Programmer**: DRY, Orthogonality, ETC (Easy To Change)
- **The Art of Readable Code**: Clear names, simplicity, reduce cognitive load
- **A Philosophy of Software Design**: Deep modules, information hiding, pull complexity down

### Language Idioms (Enforced)

| Language | Requirements |
|----------|--------------|
| TypeScript | Strict types, no `any`/`unknown`, proper interfaces |
| Go | Idiomatic Go, accept interfaces/return structs, handle errors |
| Python | Pythonic, type hints, PEP 8, dataclasses |
| Rust | Embrace borrow checker, `Result`/`Option`, clippy clean |

See `/implement` command for full coding standards.

---

## Commands

| Command | Context | Purpose |
|---------|---------|---------|
| `/create` | Subtask | Interview → bead (with templates) + spec.md |
| `/start [bead-id]` | Main | bd ready → find/setup bead, load context |
| `/scout <target>` | Main | Quick async exploration (fire-and-forget) |
| `/research <bead-id>` | Subtask | **Interactive:** explore → present → iterate → research.md |
| `/plan <bead-id>` | Subtask | **Interactive:** generate → walk through → iterate until approved → plan.md + child beads |
| `/implement <bead-id>` | Subtask | Execute plan with coach checkpoints |
| `/coach <bead-id>` | Subtask | Adversarial validation against spec.md |
| `/finish [bead-id]` | Subtask | Coach review → commit + close bead |
| `/handoff` | Subtask | Create handoff document for session continuity |
| `/rehydrate` | Subtask | Resume work from latest handoff |

### Atomic Workflow (Single Task)

For simple tasks without subtasks:

```bash
/create                   # Interview -> bead + spec.md
/start bd-xxx             # Setup workspace
/research bd-xxx          # INTERACTIVE: explore -> discuss -> iterate -> research.md
                          # (back-and-forth until you approve -> research.md)
/plan bd-xxx              # INTERACTIVE: Plan ONCE, walk through all phases
                          # (iterate in conversation until approved, child beads created after)
/implement bd-xxx         # Execute all phases
/finish bd-xxx            # Commit -> PR
```

**Note:** `/research` and `/plan` are interactive sessions with back-and-forth dialogue. Artifacts are written during the conversation, not passively reviewed after.

### Epic Workflow (Large Features)

For features with multiple phases. **Research and planning happen ONCE at the epic level.**

```bash
/create                   # Creates bd-xxx (epic) + spec.md
/start bd-xxx             # Setup workspace
/research bd-xxx          # INTERACTIVE: Research ONCE for entire epic
                          # (back-and-forth until you approve -> research.md)
/plan bd-xxx              # INTERACTIVE: Plan ONCE, walk through all phases
                          # (child beads bd-xxx.1, .2, .3 created AFTER approval)

# Now implement/finish each phase (no research/plan per subtask)
/implement bd-xxx.1       # Execute Phase 1 (uses rich bead description + plan.md)
/finish bd-xxx.1          # Commit Phase 1

/implement bd-xxx.2       # Execute Phase 2
/finish bd-xxx.2          # Commit Phase 2

/implement bd-xxx.3       # Execute Phase 3
/finish bd-xxx.3          # Commit Phase 3

/finish bd-xxx            # Close parent -> PR (all children must be closed)
```

**Note:** 
- `/research` and `/plan` on child beads (e.g., `bd-xxx.1`) will be blocked with guidance to use the parent bead ID.
- Child beads have rich descriptions from `/plan` that enable standalone execution.

### Quick Start & Session Continuity

```bash
# Quick start (find existing bead)
/start                    # Shows bd ready output, pick one
/start bd-xxx --worktree  # Direct start with worktree
/start bd-xxx --branch    # Direct start with feature branch

# Using templates
/create                   # Will offer: epic, feature, bug templates

# Session continuity (Frequent Intentional Compaction)
/handoff                  # Context limit approaching? Save state
/rehydrate                # New session? Continue from handoff
```

---

## Human Review Points

| After | Review | Why |
|-------|--------|-----|
| `/create` | `spec.md` | Ensure problem is well-defined |
| `/start` | Loaded context | Understand state before research |
| `/research` | **Interactive dialogue** | Bad research = bad plan = bad code. Conversation IS review. |
| `/plan` | **Interactive dialogue** | Approve approach AND phases. Child beads created after approval. |
| `/rehydrate` | Restored context | Confirm state before continuing |
| `/finish` | Commits + PR | Final validation |

**Note:** `/research` and `/plan` are always interactive. You cannot passively review artifacts - you must engage in dialogue with the agent until satisfied.

---

## Subagents

Commands spawn specialized subagents for parallel exploration.

**Primary Agents (oh-my-opencode):**
| Agent | Model | Purpose |
|-------|-------|---------|
| `OmO` | Claude Opus 4.5 | Main orchestrator - plans, delegates, executes complex tasks |
| `OmO-Plan` | (inherits from plan) | Plan agent variant for structured planning |

**Local Codebase Agents:**
| Agent | Model | Purpose |
|-------|-------|---------|
| `explore` | Grok Code | Fast codebase exploration, contextual grep (blazing fast, free) |
| `codebase-analyzer` | Claude Opus 4.5 | Deep code understanding with file:line refs (LSP-enabled) |
| `codebase-pattern-finder` | Claude Opus 4.5 | Find similar implementations (AST-grep enabled) |

**External Research Agents (oh-my-opencode):**
| Agent | Model | Purpose |
|-------|-------|---------|
| `librarian` | Claude Sonnet 4.5 | Official docs (Context7), GitHub search (grep_app), web search (Exa) |
| `oracle` | GPT-5.2 | Architecture review, debugging, design tradeoffs |

**Specialized Agents (oh-my-opencode):**
| Agent | Model | Purpose |
|-------|-------|---------|
| `frontend-ui-ux-engineer` | Gemini 2.5 Pro | UI development - designer-turned-developer |
| `document-writer` | Gemini 2.5 Pro | Technical writing (README, API docs, guides) |
| `multimodal-looker` | Gemini 2.5 Flash | Image/PDF analysis - extracts info from visual content |

### Parallel Execution

Agents run in background for maximum throughput:

```
Phase 1 - Locate (parallel background tasks):
├─ background_task(agent="explore", prompt="Find component A")
├─ background_task(agent="explore", prompt="Find component B")
└─ background_task(agent="codebase-pattern-finder", prompt="Find similar patterns")
[Continue working, collect results when needed]

Phase 2 - Analyze (parallel background tasks):
├─ background_task(agent="codebase-analyzer", prompt="Analyze component A")
└─ background_task(agent="codebase-analyzer", prompt="Analyze component B")
[Continue working, collect results when needed]

Synthesize findings → artifact
```

**Background Agent Workflow:**
- Launch multiple agents concurrently with `background_task`
- System notifies when each completes
- Collect results with `background_output(task_id="...")`
- Cancel all before final answer: `background_cancel(all=true)`

---

## Beads Features Utilized

### Ready Work Detection
```bash
bd ready --json --limit 10   # Find unblocked work
bd blocked                   # Show blocked beads
bd stats                     # Project statistics
```

### Templates
```bash
bd create --from-template epic "Q4 Platform"
bd create --from-template feature "Add OAuth"
bd create --from-template bug "Auth fails" -p 0
```

### Hierarchical IDs (Work Breakdown)

Child beads enable atomic, trackable work per phase:

```
bd-a1b2      [epic] Auth System        ← parent bead
bd-a1b2.1    [task] Phase 1: Schema    ← child bead (created by /plan)
bd-a1b2.2    [task] Phase 2: API       ← child bead
bd-a1b2.3    [task] Phase 3: Frontend  ← child bead
```

**Workflow with child beads:**
```bash
/create                    # Creates bd-a1b2 (epic)
/plan bd-a1b2              # Creates plan.md + offers child beads
                           # Creates bd-a1b2.1, bd-a1b2.2, bd-a1b2.3

/implement bd-a1b2.1       # Work on Phase 1 ONLY
/finish bd-a1b2.1          # Commit Phase 1, close child

/implement bd-a1b2.2       # Work on Phase 2 ONLY
/finish bd-a1b2.2          # Commit Phase 2, close child

/implement bd-a1b2.3       # Work on Phase 3 ONLY
/finish bd-a1b2.3          # Commit Phase 3, close child

/finish bd-a1b2            # Close parent (all children must be closed)
```

**Benefits:**
- Each phase independently trackable (`bd list` shows progress)
- Atomic commits per phase
- Can `/handoff` and `/rehydrate` per phase
- `bd ready` shows which phases are unblocked

### Dependency Types
- `blocks` - Hard blocker (default)
- `related` - Soft relationship
- `parent-child` - Hierarchical (child depends on parent)
- `discovered-from` - Found during work on another bead (inherits source_repo)

### Memory Decay (Compaction)
```bash
bd compact --analyze --json  # Get candidates (closed 30+ days)
# Agent summarizes content
bd compact --apply --id bd-xxx --summary summary.txt
```

---

## Artifacts

Artifacts are **local-only working files** - never committed to git. The `/start` command auto-adds `.beads/artifacts/` to `.gitignore`.

**Why local-only?**
- Artifacts contain session-specific working state (research notes, draft plans, handoffs)
- They become stale quickly and would clutter git history
- Different developers may have different artifacts for the same bead
- The PR description and git history are the permanent record; artifacts are ephemeral

```
.beads/
└── artifacts/           # ← In .gitignore, never committed
    └── <bead-id>/
        ├── spec.md                # Created by /create
        ├── exploration-context.md # Created by /start (seeds /research)
        ├── research.md            # Created by /research
        ├── plan.md                # Created by /plan
        ├── review.md              # Created by /finish
        └── handoffs/              # Session continuity
            └── YYYY-MM-DD_HH-MM-SS_handoff.md  # Created by /handoff
```

### Progress Tracking

Progress tracked in `plan.md`:

```markdown
## Phase 1: Setup ✓ COMPLETE
- [x] Create migration
- [x] Add model

## Phase 2: API (in progress)
- [x] Create handler
- [ ] Add validation
- [ ] Write tests

## Child Beads (if created)
| Phase | Bead ID | Status |
|-------|---------|--------|
| Phase 1: Setup | bd-xxx.1 | closed ✓ |
| Phase 2: API | bd-xxx.2 | open |
| Phase 3: Frontend | bd-xxx.3 | open |
```

### Artifact Policy

Artifacts in `.beads/artifacts/<bead-id>/` are **working files**, not permanent documentation.

| Artifact | Purpose | After PR Merge |
|----------|---------|----------------|
| `spec.md` | Define the problem | Bead metadata suffices |
| `research.md` | Guide planning | Delete |
| `plan.md` | Guide implementation | Delete |
| `review.md` | Pre-PR validation | Delete |
| `handoffs/` | Session continuity | Delete |

**Rationale:**
- Artifacts exist to guide implementation, not as permanent documentation
- PR description captures the "why" for posterity
- Git history has the "what" (the actual changes)
- Keeping stale artifacts creates confusion

---

## Context Management

| Command | Runs As | Why |
|---------|---------|-----|
| `/create` | Subtask | Focused interview |
| `/start` | Main | User interaction needed |
| `/scout` | Main | Quick async exploration |
| `/research` | Subtask | Deep exploration, fresh context |
| `/plan` | Subtask | Focused planning |
| `/implement` | Subtask | Clean context for coding |
| `/coach` | Subtask | Adversarial validation |
| `/finish` | Subtask | Independent review |
| `/handoff` | Subtask | Capture state before context limit |
| `/rehydrate` | Subtask | Restore state in fresh context |

Each subtask gets fresh context. Artifacts persist between phases.

### Session Continuity (Frequent Intentional Compaction)

When context window approaches limit:
1. Run `/handoff` to capture current state
2. End session gracefully
3. Start new session with `/rehydrate`
4. Continue work seamlessly from handoff

Handoffs capture:
- Current task and phase progress
- Recent changes (file:line)
- Learnings and discoveries
- Verification status
- Prioritized action items

---

## Claude 4 Best Practices (Applied)

All commands include `<claude4_guidance>` sections implementing:

| Practice | Implementation |
|----------|----------------|
| **Be Explicit** | Detailed instructions with WHY/motivation |
| **Investigate Before Acting** | Read files completely before editing |
| **Parallel Tool Calls** | Subagents and reads run in parallel |
| **Context Awareness** | Save state before compaction |
| **Avoid Overengineering** | Minimum changes, no unplanned features |
| **Default to Action** | Execute after approval, don't re-confirm |
| **Ground All Claims** | file:line references required |

---

## Alignment Summary

| Principle | Implementation |
|-----------|----------------|
| ACE-FCA: Human as Orchestrator | User runs commands, engages in interactive dialogue |
| ACE-FCA: Frequent Compaction | Each phase is subtask + /handoff for session continuity |
| ACE-FCA: Artifacts over Memory | All state in .beads/artifacts/ including handoffs |
| ACE-FCA: High-Leverage Review | Interactive dialogue in /research and /plan (not passive review) |
| ACE-FCA: "Engage with your task" | Always-interactive commands prevent rubber-stamping |
| ACE-FCA: Session Continuity | /handoff + /rehydrate for cross-session work |
| Claude 4: Explicit Instructions | XML-tagged prompts |
| Claude 4: Parallel Tool Calls | Subagents run parallel |
| Claude 4: Subagent Orchestration | Auto-delegation, fresh context per revision |
| OpenCode: Subtasks | `subtask: true` |
| Beads: Source of Truth | bd CLI for metadata |
| Beads: Atomic Work Breakdown | Child beads (bd-xxx.1) with rich descriptions |
| Beads: Hierarchical Completion | Parent can't close until all children closed |
| oh-my-opencode: Multi-Model | OmO orchestrates specialized agents (Oracle, Librarian, etc.) |
| oh-my-opencode: Background Tasks | Parallel agent execution with notification on completion |

```
```

```
Tool: webfetch

**Input:**
```json
{
  "url": "https://github.com/lleewwiiss/opencode-maestro/tree/main/templates/.opencode",
  "format": "markdown"
}
```
**Output:**
```
                    opencode-maestro/templates/.opencode at main · lleewwiiss/opencode-maestro · GitHub                                             

[Skip to content](#start-of-content)   

## Navigation Menu

Toggle navigation

[](/)

[Sign in](/login?return_to=https%3A%2F%2Fgithub.com%2Flleewwiiss%2Fopencode-maestro%2Ftree%2Fmain%2Ftemplates%2F.opencode)

Appearance settings

  

-   Platform
    
    -   AI CODE CREATION
        
        -   [
            
            GitHub CopilotWrite better code with AI
            
            ](https://github.com/features/copilot)
        -   [
            
            GitHub SparkBuild and deploy intelligent apps
            
            ](https://github.com/features/spark)
        -   [
            
            GitHub ModelsManage and compare prompts
            
            ](https://github.com/features/models)
        -   [
            
            MCP RegistryNewIntegrate external tools
            
            ](https://github.com/mcp)
        
    -   DEVELOPER WORKFLOWS
        
        -   [
            
            ActionsAutomate any workflow
            
            ](https://github.com/features/actions)
        -   [
            
            CodespacesInstant dev environments
            
            ](https://github.com/features/codespaces)
        -   [
            
            IssuesPlan and track work
            
            ](https://github.com/features/issues)
        -   [
            
            Code ReviewManage code changes
            
            ](https://github.com/features/code-review)
        
    -   APPLICATION SECURITY
        
        -   [
            
            GitHub Advanced SecurityFind and fix vulnerabilities
            
            ](https://github.com/security/advanced-security)
        -   [
            
            Code securitySecure your code as you build
            
            ](https://github.com/security/advanced-security/code-security)
        -   [
            
            Secret protectionStop leaks before they start
            
            ](https://github.com/security/advanced-security/secret-protection)
        
    -   EXPLORE
        
        -   [Why GitHub](https://github.com/why-github)
        -   [Documentation](https://docs.github.com)
        -   [Blog](https://github.blog)
        -   [Changelog](https://github.blog/changelog)
        -   [Marketplace](https://github.com/marketplace)
        
    
    [View all features](https://github.com/features)
    
-   Solutions
    
    -   BY COMPANY SIZE
        
        -   [Enterprises](https://github.com/enterprise)
        -   [Small and medium teams](https://github.com/team)
        -   [Startups](https://github.com/enterprise/startups)
        -   [Nonprofits](https://github.com/solutions/industry/nonprofits)
        
    -   BY USE CASE
        
        -   [App Modernization](https://github.com/solutions/use-case/app-modernization)
        -   [DevSecOps](https://github.com/solutions/use-case/devsecops)
        -   [DevOps](https://github.com/solutions/use-case/devops)
        -   [CI/CD](https://github.com/solutions/use-case/ci-cd)
        -   [View all use cases](https://github.com/solutions/use-case)
        
    -   BY INDUSTRY
        
        -   [Healthcare](https://github.com/solutions/industry/healthcare)
        -   [Financial services](https://github.com/solutions/industry/financial-services)
        -   [Manufacturing](https://github.com/solutions/industry/manufacturing)
        -   [Government](https://github.com/solutions/industry/government)
        -   [View all industries](https://github.com/solutions/industry)
        
    
    [View all solutions](https://github.com/solutions)
    
-   Resources
    
    -   EXPLORE BY TOPIC
        
        -   [AI](https://github.com/resources/articles?topic=ai)
        -   [Software Development](https://github.com/resources/articles?topic=software-development)
        -   [DevOps](https://github.com/resources/articles?topic=devops)
        -   [Security](https://github.com/resources/articles?topic=security)
        -   [View all topics](https://github.com/resources/articles)
        
    -   EXPLORE BY TYPE
        
        -   [Customer stories](https://github.com/customer-stories)
        -   [Events & webinars](https://github.com/resources/events)
        -   [Ebooks & reports](https://github.com/resources/whitepapers)
        -   [Business insights](https://github.com/solutions/executive-insights)
        -   [GitHub Skills](https://skills.github.com)
        
    -   SUPPORT & SERVICES
        
        -   [Documentation](https://docs.github.com)
        -   [Customer support](https://support.github.com)
        -   [Community forum](https://github.com/orgs/community/discussions)
        -   [Trust center](https://github.com/trust-center)
        -   [Partners](https://github.com/partners)
        
    
-   Open Source
    
    -   COMMUNITY
        
        -   [
            
            GitHub SponsorsFund open source developers
            
            ](https://github.com/sponsors)
        
    -   PROGRAMS
        
        -   [Security Lab](https://securitylab.github.com)
        -   [Maintainer Community](https://maintainers.github.com)
        -   [Accelerator](https://github.com/accelerator)
        -   [Archive Program](https://archiveprogram.github.com)
        
    -   REPOSITORIES
        
        -   [Topics](https://github.com/topics)
        -   [Trending](https://github.com/trending)
        -   [Collections](https://github.com/collections)
        
    
-   Enterprise
    
    -   ENTERPRISE SOLUTIONS
        
        -   [
            
            Enterprise platformAI-powered developer platform
            
            ](https://github.com/enterprise)
        
    -   AVAILABLE ADD-ONS
        
        -   [
            
            GitHub Advanced SecurityEnterprise-grade security features
            
            ](https://github.com/security/advanced-security)
        -   [
            
            Copilot for BusinessEnterprise-grade AI features
            
            ](https://github.com/features/copilot/copilot-business)
        -   [
            
            Premium SupportEnterprise-grade 24/7 support
            
            ](https://github.com/premium-support)
        
    
-   [Pricing](https://github.com/pricing)

Search or jump to...

# Search code, repositories, users, issues, pull requests...

Search

Clear

[Search syntax tips](https://docs.github.com/search-github/github-code-search/understanding-github-code-search-syntax)

# Provide feedback

We read every piece of feedback, and take your input very seriously.

 Include my email address so I can be contacted

Cancel Submit feedback

# Saved searches

## Use saved searches to filter your results more quickly

Name  

Query 

To see all available qualifiers, see our [documentation](https://docs.github.com/search-github/github-code-search/understanding-github-code-search-syntax).

Cancel Create saved search

[Sign in](/login?return_to=https%3A%2F%2Fgithub.com%2Flleewwiiss%2Fopencode-maestro%2Ftree%2Fmain%2Ftemplates%2F.opencode)

[Sign up](/signup?ref_cta=Sign+up&ref_loc=header+logged+out&ref_page=%2F%3Cuser-name%3E%2F%3Crepo-name%3E%2Ffiles%2Fdisambiguate&source=header-repo&source_repo=lleewwiiss%2Fopencode-maestro)

Appearance settings

Resetting focus

You signed in with another tab or window. Reload to refresh your session. You signed out in another tab or window. Reload to refresh your session. You switched accounts on another tab or window. Reload to refresh your session. Dismiss alert

[lleewwiiss](/lleewwiiss) / **[opencode-maestro](/lleewwiiss/opencode-maestro)** Public

-   [Notifications](/login?return_to=%2Flleewwiiss%2Fopencode-maestro) You must be signed in to change notification settings
-   [Fork 4](/login?return_to=%2Flleewwiiss%2Fopencode-maestro)
-   [Star 32](/login?return_to=%2Flleewwiiss%2Fopencode-maestro)
    

-   [Code](/lleewwiiss/opencode-maestro)
-   [Issues 0](/lleewwiiss/opencode-maestro/issues)
-   [Pull requests 1](/lleewwiiss/opencode-maestro/pulls)
-   [Actions](/lleewwiiss/opencode-maestro/actions)
-   [Projects 0](/lleewwiiss/opencode-maestro/projects)
-   [Security](/lleewwiiss/opencode-maestro/security)
    
    [](/lleewwiiss/opencode-maestro/security)
    
    [](/lleewwiiss/opencode-maestro/security)
    
    [](/lleewwiiss/opencode-maestro/security)
    
    [
    
    ### Uh oh!
    
    ](/lleewwiiss/opencode-maestro/security)
    
    [There was an error while loading.](/lleewwiiss/opencode-maestro/security) Please reload this page.
    
-   [Insights](/lleewwiiss/opencode-maestro/pulse)

Additional navigation options

-   [Code](/lleewwiiss/opencode-maestro)
-   [Issues](/lleewwiiss/opencode-maestro/issues)
-   [Pull requests](/lleewwiiss/opencode-maestro/pulls)
-   [Actions](/lleewwiiss/opencode-maestro/actions)
-   [Projects](/lleewwiiss/opencode-maestro/projects)
-   [Security](/lleewwiiss/opencode-maestro/security)
-   [Insights](/lleewwiiss/opencode-maestro/pulse)

## Footer

[](https://github.com)© 2026 GitHub, Inc.

### Footer navigation

-   [Terms](https://docs.github.com/site-policy/github-terms/github-terms-of-service)
-   [Privacy](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement)
-   [Security](https://github.com/security)
-   [Status](https://www.githubstatus.com/)
-   [Community](https://github.community/)
-   [Docs](https://docs.github.com/)
-   [Contact](https://support.github.com?tags=dotcom-footer)
-   Manage cookies
-   Do not share my personal information

You can’t perform that action at this time.
```
```

---

## Assistant (Build · claude-opus-4-5 · 15.7s)

_Thinking:_

I have comprehensive information now. Let me initialize the Globex project. The user wants to analyze what can be leveraged from opencode-maestro for Globex.

Key patterns from opencode-maestro:
1. **10-turn limits** per phase - prevents infinite loops
2. **Coach-Player pattern** (adversarial validation) - Wiggum validates Ralph
3. **Structured verdicts** - APPROVED/NOT_APPROVED
4. **Gap analysis** with categorization (Critical/Important/Minor)
5. **Handoff/rehydrate** for session continuity - like progress.md
6. **External Beads CLI** for issue tracking
7. **Hierarchical work breakdown** (bd-xxx.1, bd-xxx.2)
8. **Interactive refinement** in research/plan phases
9. **Artifact policy** - local-only, delete after merge
10. **Chesterton's Fence** checks
11. **Rich child bead descriptions** for standalone execution

Now let me initialize Globex for this comparison/research project.

Got the full picture. Key patterns from opencode-maestro:

| Pattern | Maestro | Globex Status |
|---------|---------|---------------|
| **10-turn limits** | Explicit per phase | Not implemented |
| **Coach-Player** | /coach validates /implement | Ralph-Wiggum similar |
| **Structured verdicts** | APPROVED + IMMEDIATE ACTIONS | Interview has convergence |
| **Handoff/rehydrate** | Session continuity | progress.md similar |
| **Rich child descriptions** | Standalone execution context | features.json has deps |
| **Chesterton's Fence** | Required explanations | Could add to interview |
| **Interactive refinement** | Dialogue IS the review | Interview attempts this |

Initializing Globex project:

```
Tool: globex_init

**Input:**
```json
{
  "projectName": "maestro-pattern-analysis",
  "description": "Analyze opencode-maestro patterns for potential Globex improvements: turn limits, coach-player validation, handoff/rehydrate, structured verdicts"
}
```
**Output:**
```
{"success":false,"error":"Project 'maestro-pattern-analysis' already exists","projectDir":"/Users/lewissmith/Development/globex/.globex/projects/maestro-pattern-analysis"}
```
```

---

## Assistant (Build · claude-opus-4-5 · 4.8s)

_Thinking:_

The project already exists. Let me select it and check its status.

Project exists. Selecting it:

```
Tool: globex_select_project

**Input:**
```json
{
  "projectId": "maestro-pattern-analysis"
}
```
**Output:**
```
{"success":true,"activeProject":"maestro-pattern-analysis"}
```
```

```
Tool: globex_status

**Input:**
```json
{}
```
**Output:**
```
Project: maestro-pattern-analysis
Phase: init
Created: 2026-01-07T07:15:26.400Z
Updated: 2026-01-07T07:15:26.402Z

Approvals:
  (none)

Artifacts:
  (none)

All Projects (* = active):
    maestro-leverage-analysis (init)
    maestro-analysis (init)
  * maestro-pattern-analysis (init)
```
```

---

## Assistant (Build · claude-opus-4-5 · 11.7s)

_Thinking:_

The project is in init phase. From the supermemory context, I can see a comprehensive analysis was already done comparing maestro with Globex. The user has asked me to initialize and potentially leverage patterns.

Let me summarize what's actionable for Globex from maestro:

**Patterns to potentially adopt:**
1. Turn limits (10/phase) - prevents runaway
2. Explicit Chesterton's Fence checks in interview
3. Structured APPROVED/NOT_APPROVED verdicts
4. Handoff/rehydrate as first-class concept

**Already similar:**
- Coach-Player ≈ Ralph-Wiggum
- Artifacts ≈ .globex files
- Interactive refinement ≈ Interview phase

**Key difference:**
- Maestro uses external Beads CLI (debuggable)
- Globex uses internal features.json (self-contained)

The user should decide whether to proceed with research phase to dig deeper, or if this summary is enough.

Project active: `maestro-pattern-analysis` (init phase)

**Actionable patterns from maestro:**

| Pattern | Implementation Effort | Value |
|---------|----------------------|-------|
| **Turn limits** (10/phase) | Low - add counter to Ralph | High - prevents runaway |
| **Chesterton's Fence** in interview | Low - prompt addition | Medium - better validation |
| **APPROVED/NOT_APPROVED verdicts** | Already have convergence | - |
| **Handoff/rehydrate** | progress.md exists | Refine for explicit handoffs |

**Already covered:**
- Coach-Player = Ralph-Wiggum
- Artifacts = .globex files  
- Interactive = Interview phase

**Key tradeoff:**
- Maestro: External Beads CLI (debuggable, manual)
- Globex: Internal features.json (self-contained, automated)

Want me to proceed to research phase for deeper analysis, or is this summary sufficient to inform next steps?

---

