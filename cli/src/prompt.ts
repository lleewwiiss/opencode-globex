/**
 * Pre-TUI prompts using raw mode for input.
 */

/**
 * Prompt user for y/n confirmation.
 */
export async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`${message} (y/n) `)

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()

  return new Promise<boolean>((resolve, reject) => {
    const onData = (data: Buffer) => {
      const char = data.toString()

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }
      process.stdin.pause()
      process.stdin.removeListener("data", onData)

      process.stdout.write(char + "\n")

      if (char === "\x03") {
        reject(new Error("Input aborted"))
        return
      }

      resolve(char.charAt(0).toLowerCase() === "y")
    }

    process.stdin.on("data", onData)
  })
}

/**
 * Prompt user for text input.
 */
export async function input(message: string): Promise<string> {
  process.stdout.write(`${message}: `)

  process.stdin.resume()
  process.stdin.setEncoding("utf8")

  return new Promise<string>((resolve, reject) => {
    const onData = (data: string) => {
      process.stdin.pause()
      process.stdin.removeListener("data", onData)

      const text = data.trim()

      if (text === "\x03") {
        reject(new Error("Input aborted"))
        return
      }

      resolve(text)
    }

    process.stdin.on("data", onData)
  })
}

/**
 * Prompt user to select from options.
 */
export async function select(message: string, options: string[]): Promise<number> {
  console.log(message)
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`))
  process.stdout.write(`Select [1-${options.length}]: `)

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()

  return new Promise<number>((resolve, reject) => {
    const onData = (data: Buffer) => {
      const char = data.toString()

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }
      process.stdin.pause()
      process.stdin.removeListener("data", onData)

      process.stdout.write(char + "\n")

      if (char === "\x03") {
        reject(new Error("Input aborted"))
        return
      }

      const num = parseInt(char, 10)
      if (num >= 1 && num <= options.length) {
        resolve(num - 1)
      } else {
        resolve(0) // default to first option
      }
    }

    process.stdin.on("data", onData)
  })
}
