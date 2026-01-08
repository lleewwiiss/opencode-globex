#!/usr/bin/env bun
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

const DEFAULT_MODEL = "anthropic/claude-sonnet-4"

await yargs(hideBin(process.argv))
  .scriptName("globex")
  .usage("$0 <command> [options]")
  .command(
    "init <description>",
    "Initialize new workflow",
    (yargs) =>
      yargs.positional("description", {
        type: "string",
        demandOption: true,
        describe: "Project description",
      }),
    (argv) => {
      console.log(`Initializing project: ${argv.description}`)
      console.log(`Model: ${argv.model}`)
    }
  )
  .command(
    "continue [project]",
    "Continue existing workflow",
    (yargs) =>
      yargs.positional("project", {
        type: "string",
        describe: "Project ID to continue (defaults to active project)",
      }),
    (argv) => {
      const project = argv.project ?? "active"
      console.log(`Continuing project: ${project}`)
      console.log(`Model: ${argv.model}`)
    }
  )
  .command(
    "status",
    "Show current status",
    () => {},
    () => {
      console.log("Status: not implemented")
    }
  )
  .option("model", {
    alias: "m",
    type: "string",
    default: DEFAULT_MODEL,
    describe: "Model to use for AI operations",
  })
  .demandCommand(1, "You must specify a command")
  .strict()
  .help()
  .parse()
