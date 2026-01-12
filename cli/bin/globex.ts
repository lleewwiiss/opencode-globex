#!/usr/bin/env node
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs"
import { join } from "path"
import { main } from "../src/index.js"
import { upsertProject, loadRegistry, getProject, removeProject, type RegistryEntry } from "../src/state/registry.js"
import { removeWorktree } from "../src/git.js"
import { rmSync, unlinkSync } from "fs"

const DEFAULT_MODEL = "openai/gpt-5.2-codex"
const GLOBEX_DIR = ".globex"
const PROJECTS_DIR = "projects"
const ACTIVE_PROJECT_FILE = "active-project"

function getActiveProject(workdir: string): string | undefined {
  const activePath = join(workdir, GLOBEX_DIR, ACTIVE_PROJECT_FILE)
  if (existsSync(activePath)) {
    return readFileSync(activePath, "utf-8").trim()
  }
  // Fallback: find most recent project
  const projectsDir = join(workdir, GLOBEX_DIR, PROJECTS_DIR)
  if (!existsSync(projectsDir)) return undefined
  const projects = readdirSync(projectsDir)
  return projects[0]
}

function setActiveProject(workdir: string, projectId: string): void {
  const globexDir = join(workdir, GLOBEX_DIR)
  if (!existsSync(globexDir)) mkdirSync(globexDir, { recursive: true })
  writeFileSync(join(globexDir, ACTIVE_PROJECT_FILE), projectId)
}

function createProject(workdir: string, projectId: string, description: string): void {
  const projectDir = join(workdir, GLOBEX_DIR, PROJECTS_DIR, projectId)
  mkdirSync(projectDir, { recursive: true })
  
  const state = {
    projectId,
    projectName: projectId,
    description,
    currentPhase: "init",
    approvals: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  writeFileSync(join(projectDir, "state.json"), JSON.stringify(state, null, 2))
  setActiveProject(workdir, projectId)
}

function projectExists(workdir: string, projectId: string): boolean {
  return existsSync(join(workdir, GLOBEX_DIR, PROJECTS_DIR, projectId, "state.json"))
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
}

const workdir = process.cwd()

await yargs(hideBin(process.argv))
  .scriptName("globex")
  .usage("$0 [command]\n\nCommands:\n  globex                  Resume active project or create with -d\n  globex status           List all projects\n  globex switch <id>      Switch to a project\n  globex init <desc>      Create a new project\n  globex abandon <id>     Remove a project\n  globex workspace        Manage worktrees")
  .command(
    "status",
    "List all globex projects",
    () => {},
    async () => {
      const registry = await loadRegistry()
      const projects = Object.entries(registry.projects)
      
      if (projects.length === 0) {
        console.log("No projects found.")
        return
      }
      
      const activeProjectId = getActiveProject(workdir)
      
      // Header
      console.log("   ID                              PHASE              PATH")
      console.log("   ─────────────────────────────── ────────────────── ─────────────────────────────")
      
      for (const [id, entry] of projects) {
        const isActive = id === activeProjectId
        const arrow = isActive ? "→" : " "
        
        // Determine path display
        let pathDisplay: string
        if (entry.worktreePath) {
          pathDisplay = entry.worktreePath
        } else if (entry.repoPath === workdir) {
          pathDisplay = "(current)"
        } else {
          pathDisplay = entry.repoPath
        }
        
        const idCol = id.padEnd(33)
        const phaseCol = entry.phase.padEnd(18)
        
        console.log(`${arrow}  ${idCol} ${phaseCol} ${pathDisplay}`)
      }
    }
  )
  .command(
    "switch <project-id>",
    "Switch to a different globex project",
    (yargs) =>
      yargs
        .positional("project-id", {
          type: "string",
          describe: "Project ID to switch to",
          demandOption: true,
        }),
    async (argv) => {
      const projectId = argv["project-id"] as string
      const entry = await getProject(projectId)
      
      if (!entry) {
        console.error(`Project '${projectId}' not found in registry.`)
        process.exitCode = 1
        return
      }
      
      // Check if project is in current repo
      if (entry.repoPath === workdir) {
        // Project in current repo - set active and check for worktree
        setActiveProject(workdir, projectId)
        console.log(`Switched to project: ${projectId}`)
        
        if (entry.worktreePath) {
          console.log(`cd ${entry.worktreePath}`)
        }
      } else {
        // Project in different repo
        if (entry.worktreePath) {
          console.log(`cd ${entry.worktreePath}`)
        } else {
          console.log(`cd ${entry.repoPath}`)
        }
      }
    }
  )
  .command(
    "abandon <project-id>",
    "Abandon and remove a globex project",
    (yargs) =>
      yargs
        .positional("project-id", {
          type: "string",
          describe: "Project ID to abandon",
          demandOption: true,
        })
        .option("force", {
          alias: "f",
          type: "boolean",
          default: false,
          describe: "Skip confirmation and force removal",
        }),
    async (argv) => {
      const projectId = argv["project-id"] as string
      const force = argv.force as boolean
      const entry = await getProject(projectId)
      
      if (!entry) {
        console.error(`Project '${projectId}' not found in registry.`)
        process.exitCode = 1
        return
      }
      
      if (!force) {
        console.log(`Project: ${projectId}`)
        console.log(`Path: ${entry.worktreePath || entry.repoPath}`)
        console.log(`Phase: ${entry.phase}`)
        console.log("")
        console.log("Run with --force to confirm removal.")
        return
      }
      
      // Remove worktree if exists
      if (entry.worktreePath) {
        console.log(`Removing worktree: ${entry.worktreePath}`)
        try {
          await removeWorktree(entry.repoPath, entry.worktreePath)
        } catch {
          // Worktree removal failed, try manual cleanup
          try {
            rmSync(entry.worktreePath, { recursive: true, force: true })
          } catch {
            // Ignore cleanup errors
          }
        }
      }
      
      // Remove project directory from .globex/projects
      const projectDir = join(workdir, GLOBEX_DIR, PROJECTS_DIR, projectId)
      if (existsSync(projectDir)) {
        console.log(`Removing project data: ${projectDir}`)
        rmSync(projectDir, { recursive: true, force: true })
      }
      
      // Remove from registry
      console.log(`Removing from registry: ${projectId}`)
      await removeProject(projectId)
      
      // Clear active-project if was active
      const activeProjectId = getActiveProject(workdir)
      if (activeProjectId === projectId) {
        const activePath = join(workdir, GLOBEX_DIR, ACTIVE_PROJECT_FILE)
        if (existsSync(activePath)) {
          unlinkSync(activePath)
          console.log("Cleared active project.")
        }
      }
      
      console.log(`Abandoned project: ${projectId}`)
    }
  )
  .command(
    "workspace",
    "Manage git worktrees for globex projects",
    (yargs) =>
      yargs
        .command(
          "list",
          "List projects with active worktrees",
          () => {},
          async () => {
            const registry = await loadRegistry()
            const projects = Object.entries(registry.projects)
            const withWorktrees = projects.filter(([, entry]) => entry.worktreePath)
            
            if (withWorktrees.length === 0) {
              console.log("No projects with active worktrees.")
              return
            }
            
            console.log("   ID                              PHASE              WORKTREE PATH")
            console.log("   ─────────────────────────────── ────────────────── ─────────────────────────────")
            
            for (const [id, entry] of withWorktrees) {
              const idCol = id.padEnd(33)
              const phaseCol = entry.phase.padEnd(18)
              console.log(`   ${idCol} ${phaseCol} ${entry.worktreePath}`)
            }
          }
        )
        .command(
          "cleanup",
          "List completed projects with worktrees that can be cleaned up",
          () => {},
          async () => {
            const registry = await loadRegistry()
            const projects = Object.entries(registry.projects)
            const completed = projects.filter(
              ([, entry]) => entry.worktreePath && entry.phase === "complete"
            )
            
            if (completed.length === 0) {
              console.log("No completed projects with worktrees to clean up.")
              return
            }
            
            console.log("Completed projects with worktrees:")
            console.log("")
            console.log("   ID                              WORKTREE PATH")
            console.log("   ─────────────────────────────── ─────────────────────────────")
            
            for (const [id, entry] of completed) {
              const idCol = id.padEnd(33)
              console.log(`   ${idCol} ${entry.worktreePath}`)
            }
            
            console.log("")
            console.log("Run 'globex abandon <id> --force' to remove a project and its worktree.")
          }
        )
        .demandCommand(1, "Please specify a workspace subcommand: list or cleanup"),
    () => {}
  )
  .command(
    "init <description>",
    "Initialize a new globex project",
    (yargs) =>
      yargs
        .positional("description", {
          type: "string",
          describe: "Description of the project/feature",
          demandOption: true,
        }),
    async (argv) => {
      const description = argv.description as string
      const projectId = slugify(description)
      
      if (projectExists(workdir, projectId)) {
        console.log(`Resuming existing project: ${projectId}`)
      } else {
        console.log(`Creating project: ${projectId}`)
        createProject(workdir, projectId, description)
      }
      
      // Register in global registry
      const registryEntry: RegistryEntry = {
        name: description,
        repoPath: workdir,
        phase: "init",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await upsertProject(projectId, registryEntry)
      
      setActiveProject(workdir, projectId)
      
      // Launch TUI
      await main({
        projectId,
        model: argv.model as string,
      })
    }
  )
  .command(
    "$0",
    "Run globex TUI (resume active project or create with -d)",
    (yargs) =>
      yargs
        .option("project", {
          alias: "p",
          type: "string",
          describe: "Project ID to use",
        })
        .option("description", {
          alias: "d",
          type: "string",
          describe: "Description for new project (creates if not exists)",
        })
        .option("reset", {
          alias: "r",
          type: "boolean",
          default: false,
          describe: "Reset project state and start fresh",
        }),
    async (argv) => {
      let projectId = argv.project
      
      // If description provided, always create new project
      if (argv.description) {
        projectId = slugify(argv.description)
        if (projectExists(workdir, projectId)) {
          console.log(`Resuming existing project: ${projectId}`)
        } else {
          console.log(`Creating project: ${projectId}`)
          createProject(workdir, projectId, argv.description)
          
          // Register in global registry
          const registryEntry: RegistryEntry = {
            name: argv.description,
            repoPath: workdir,
            phase: "init",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          await upsertProject(projectId, registryEntry)
        }
      }
      
      // Fall back to active project if no description
      if (!projectId) {
        projectId = getActiveProject(workdir)
      }
      
      // If still no project, error
      if (!projectId) {
        console.error("No project found. Run with --description to create one:")
        console.error("  globex --description \"My feature description\"")
        console.error("")
        console.error("Or use a subcommand:")
        console.error("  globex status        - List all projects")
        console.error("  globex switch <id>   - Switch to a project")
        console.error("  globex init <desc>   - Create a new project")
        process.exitCode = 1
        return
      }
      
      // Check project exists
      if (!projectExists(workdir, projectId)) {
        console.error(`Project '${projectId}' not found.`)
        process.exitCode = 1
        return
      }
      
      setActiveProject(workdir, projectId)
      
      // Run TUI
      await main({
        projectId,
        model: argv.model as string,
      })
    }
  )
  .option("model", {
    alias: "m",
    type: "string",
    default: DEFAULT_MODEL,
    describe: "Model to use for AI operations",
  })
  .help()
  .alias("h", "help")
  .version(false)
  .strict()
  .parse()
