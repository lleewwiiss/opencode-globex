#!/usr/bin/env bun
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs"
import { join } from "path"
import { main } from "../src/index.js"

const DEFAULT_MODEL = "anthropic/claude-opus-4-5"
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
  .usage("$0 [options]")
  .command(
    "$0",
    "Run globex TUI (auto-detects or creates project)",
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
        process.exit(1)
      }
      
      // Check project exists
      if (!projectExists(workdir, projectId)) {
        console.error(`Project '${projectId}' not found.`)
        process.exit(1)
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
