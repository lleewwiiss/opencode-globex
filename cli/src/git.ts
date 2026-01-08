import { Effect, Layer, Context, Schema } from "effect"
import { Command, CommandExecutor } from "@effect/platform"
import { NodeCommandExecutor, NodeFileSystem } from "@effect/platform-node"

export class GitError extends Schema.TaggedError<GitError>()(
  "GitError",
  { message: Schema.String, command: Schema.String }
) {}

export interface Commit {
  hash: string
  subject: string
  author: string
  date: string
}

export interface DiffStats {
  filesChanged: number
  insertions: number
  deletions: number
  files: string[]
}

export class GitService extends Context.Tag("GitService")<GitService, {
  readonly getHeadHash: (workdir: string) => Effect.Effect<string, GitError>
  readonly getCommitsSince: (workdir: string, hash: string) => Effect.Effect<Commit[], GitError>
  readonly getDiffStats: (workdir: string) => Effect.Effect<DiffStats, GitError>
  readonly commitChanges: (workdir: string, message: string) => Effect.Effect<string, GitError>
}>() {}

export const GitServiceLive = Layer.effect(
  GitService,
  Effect.gen(function* () {
    const executor = yield* CommandExecutor.CommandExecutor

    const runGit = (args: string[], workdir: string): Effect.Effect<string, GitError> =>
      Effect.gen(function* () {
        const cmd = Command.make("git", ...args).pipe(Command.workingDirectory(workdir))
        const result = yield* executor.string(cmd).pipe(
          Effect.mapError((e) => new GitError({ message: String(e), command: `git ${args.join(" ")}` }))
        )
        return result.trim()
      })

    const getHeadHash = (workdir: string): Effect.Effect<string, GitError> =>
      runGit(["rev-parse", "HEAD"], workdir)

    const getCommitsSince = (workdir: string, hash: string): Effect.Effect<Commit[], GitError> =>
      Effect.gen(function* () {
        const output = yield* runGit(
          ["log", `${hash}..HEAD`, "--pretty=format:%H|%s|%an|%aI"],
          workdir
        )
        if (!output) return []
        return output.split("\n").map((line) => {
          const [hash, subject, author, date] = line.split("|")
          return { hash, subject, author, date }
        })
      })

    const getDiffStats = (workdir: string): Effect.Effect<DiffStats, GitError> =>
      Effect.gen(function* () {
        const cmd = Command.make("git", "status", "--porcelain").pipe(Command.workingDirectory(workdir))
        const statusOutput = yield* executor.string(cmd).pipe(
          Effect.mapError((e) => new GitError({ message: String(e), command: "git status --porcelain" }))
        )

        const files = statusOutput
          .split("\n")
          .filter((line) => line.length >= 3)
          .map((line) => line.slice(3))

        if (files.length === 0) {
          return { filesChanged: 0, insertions: 0, deletions: 0, files: [] }
        }

        const diffResult = yield* runGit(["diff", "--stat", "HEAD"], workdir).pipe(
          Effect.catchAll(() => Effect.succeed(""))
        )

        let insertions = 0
        let deletions = 0
        const insertionsMatch = diffResult.match(/(\d+) insertions?\(\+\)/)
        const deletionsMatch = diffResult.match(/(\d+) deletions?\(-\)/)
        if (insertionsMatch) insertions = parseInt(insertionsMatch[1], 10)
        if (deletionsMatch) deletions = parseInt(deletionsMatch[1], 10)

        return { filesChanged: files.length, insertions, deletions, files }
      })

    const commitChanges = (workdir: string, message: string): Effect.Effect<string, GitError> =>
      Effect.gen(function* () {
        yield* runGit(["add", "-A"], workdir)
        yield* runGit(["commit", "-m", message], workdir)
        return yield* getHeadHash(workdir)
      })

    return { getHeadHash, getCommitsSince, getDiffStats, commitChanges }
  })
)

const GitLayer = GitServiceLive.pipe(
  Layer.provide(NodeCommandExecutor.layer),
  Layer.provide(NodeFileSystem.layer)
)

export const getHeadHashEffect = (workdir: string) =>
  Effect.gen(function* () {
    const service = yield* GitService
    return yield* service.getHeadHash(workdir)
  }).pipe(Effect.provide(GitLayer))

export const getCommitsSinceEffect = (workdir: string, hash: string) =>
  Effect.gen(function* () {
    const service = yield* GitService
    return yield* service.getCommitsSince(workdir, hash)
  }).pipe(Effect.provide(GitLayer))

export const getDiffStatsEffect = (workdir: string) =>
  Effect.gen(function* () {
    const service = yield* GitService
    return yield* service.getDiffStats(workdir)
  }).pipe(Effect.provide(GitLayer))

export const commitChangesEffect = (workdir: string, message: string) =>
  Effect.gen(function* () {
    const service = yield* GitService
    return yield* service.commitChanges(workdir, message)
  }).pipe(Effect.provide(GitLayer))

export const getHeadHash = async (workdir: string): Promise<string> =>
  Effect.runPromise(getHeadHashEffect(workdir))

export const getCommitsSince = async (workdir: string, hash: string): Promise<Commit[]> =>
  Effect.runPromise(getCommitsSinceEffect(workdir, hash))

export const getDiffStats = async (workdir: string): Promise<DiffStats> =>
  Effect.runPromise(getDiffStatsEffect(workdir))

export const commitChanges = async (workdir: string, message: string): Promise<string> =>
  Effect.runPromise(commitChangesEffect(workdir, message))
