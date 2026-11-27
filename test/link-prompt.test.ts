import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"
import { test, type TestContext } from "node:test"
import { fileURLToPath } from "node:url"
import { stripVTControlCharacters } from "node:util"

const entry = fileURLToPath(new URL("../src/skills4me.ts", import.meta.url))
const commandPrompt = "Select a command."
const checkoutPrompt = "Select a directory in the Git checkout."
const agentsPrompt = "Select target agents."
const cancelKeys = "\u0003"

type PromptResponse = { prompt: string; keys: string }
type RunOptions = {
  args?: string[]
  responses?: PromptResponse[]
  tty?: "both" | "stdin" | "stdout" | "neither"
}

/** Prepares a checkout below a working directory outside Git. */
function fixture(t: TestContext) {
  // Match the CLI's real paths, which expand Windows short names such as RUNNER~1.
  const root = realpathSync.native(
    mkdtempSync(join(tmpdir(), "skills4me-prompt-")),
  )
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const home = join(root, "home")
  const outside = join(root, "outside")
  const checkout = join(outside, "checkout")
  const skill = join(checkout, "skills", "example")
  mkdirSync(home)
  mkdirSync(skill, { recursive: true })
  mkdirSync(join(checkout, ".git"))
  writeFileSync(join(skill, "SKILL.md"), "# Example\n")
  return { home, outside, checkout, skill }
}

/** Runs the source CLI and provides keystrokes as each real Clack prompt appears. */
async function runCli(
  cwd: string,
  home: string,
  { args = [], responses = [], tty = "both" }: RunOptions = {},
) {
  // Emulate terminal flags on the child streams and isolate system Codex detection.
  const setup = `
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    const existsSync = fs.existsSync;
    fs.existsSync = (path) => path === "/etc/codex" ? false : existsSync(path);
    syncBuiltinESMExports();
    process.stdin.isTTY = ${tty === "both" || tty === "stdin"};
    process.stdin.setRawMode = () => process.stdin;
    process.stdout.isTTY = ${tty === "both" || tty === "stdout"};
    process.stdout.columns = 120;
  `
  const preload = `data:text/javascript,${encodeURIComponent(setup)}`
  const child = spawn(process.execPath, ["--import", preload, entry, ...args], {
    cwd,
    // Windows reads the home directory from USERPROFILE instead of HOME.
    // Clack draws Unicode symbols on Windows only in terminals it recognizes.
    env: { HOME: home, USERPROFILE: home, WT_SESSION: "skills4me-test" },
    timeout: 10_000,
  })
  const closed = once(child, "close")
  let stdout = ""
  let stderr = ""
  let answered = 0
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk
    const response = responses[answered]
    if (!response || !stdout.includes(response.prompt)) {
      return
    }
    answered++
    if (answered === responses.length) {
      child.stdin.end(response.keys)
    } else {
      child.stdin.write(response.keys)
    }
  })
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk
  })
  if (responses.length === 0) {
    child.stdin.end()
  }

  const [status, signal] = await closed
  stdout = stripVTControlCharacters(stdout)
  assert.equal(signal, null, stderr || stdout)
  assert.equal(answered, responses.length, stderr || stdout)
  return { status, stdout, stderr }
}

void test("opens the command menu and links to the detected agents selected by default", async (t) => {
  const { home, outside, skill } = fixture(t)
  mkdirSync(join(home, ".claude"))
  mkdirSync(join(home, ".codex"))
  const result = await runCli(outside, home, {
    responses: [
      { prompt: commandPrompt, keys: "\r" },
      // Clack matches typed paths as text, so type the platform separator.
      {
        prompt: checkoutPrompt,
        keys: `${sep}${join("checkout", "skills", "example")}\r`,
      },
      { prompt: agentsPrompt, keys: "\r" },
    ],
  })
  assert.equal(result.status, 0, result.stderr)
  const menuCommands = result.stdout.match(/\b(?:link|detect|adopt)\b/gu)
  assert.deepEqual(menuCommands?.slice(0, 3), ["link", "detect", "adopt"])
  assert.equal(realpathSync(join(home, ".claude", "skills", "example")), skill)
  assert.equal(realpathSync(join(home, ".agents", "skills", "example")), skill)
})

void test("Ctrl+C in the command menu exits successfully without placing links", async (t) => {
  const { home, checkout } = fixture(t)
  const result = await runCli(checkout, home, {
    responses: [{ prompt: commandPrompt, keys: cancelKeys }],
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.includes(checkoutPrompt), false)
  assert.equal(result.stdout.includes(agentsPrompt), false)
  assert.equal(existsSync(join(home, ".claude")), false)
  assert.equal(existsSync(join(home, ".agents")), false)
})

void test("keeps a bare invocation silent without two terminal streams and shows explicit help", async (t) => {
  const { home, checkout } = fixture(t)
  for (const tty of ["neither", "stdin", "stdout"] as const) {
    const result = await runCli(checkout, home, { tty })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, "")
    assert.equal(result.stderr, "")
  }

  const help = await runCli(checkout, home, { args: ["--help"] })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /USAGE:\s+skills4me/u)
  assert.equal(help.stdout.includes(commandPrompt), false)
})

void test("Ctrl+C at the checkout prompt exits successfully before placing links", async (t) => {
  const { home, outside } = fixture(t)
  const result = await runCli(outside, home, {
    args: ["link"],
    responses: [{ prompt: checkoutPrompt, keys: cancelKeys }],
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.includes(commandPrompt), false)
  assert.equal(existsSync(join(home, ".claude")), false)
  assert.equal(existsSync(join(home, ".agents")), false)
})

void test("rejects an explicit invalid checkout and requires two terminal streams to prompt", async (t) => {
  const { home, outside, checkout } = fixture(t)
  const invalid = await runCli(checkout, home, { args: ["link", outside] })
  assert.equal(invalid.status, 1, invalid.stdout || invalid.stderr)
  assert.match(invalid.stderr, /No Git checkout/u)
  assert.equal(invalid.stdout.includes(checkoutPrompt), false)

  const noCheckout = await runCli(outside, home, {
    args: ["link"],
    tty: "stdout",
  })
  assert.equal(noCheckout.status, 1, noCheckout.stdout || noCheckout.stderr)
  assert.match(noCheckout.stderr, /No Git checkout/u)
  assert.equal(noCheckout.stdout.includes(checkoutPrompt), false)
})

void test("offers only the detected agents and links to the ones kept selected", async (t) => {
  const { home, checkout, skill } = fixture(t)
  mkdirSync(join(home, ".claude"))
  mkdirSync(join(home, ".cursor"))
  const result = await runCli(checkout, home, {
    args: ["link"],
    responses: [{ prompt: agentsPrompt, keys: "cursor\t\r" }],
  })
  assert.equal(result.status, 0, result.stderr)
  // The first rendering lists all options; Clack adds the hint to the focused one.
  const firstOptions = result.stdout
    .split("Search: _\n")[1]
    ?.split("\n│  ↑/↓")[0]
  assert.equal(firstOptions, "│  ◼ Claude Code\n│  ◼ Cursor (cursor)")
  assert.equal(realpathSync(join(home, ".claude", "skills", "example")), skill)
  assert.equal(existsSync(join(home, ".cursor", "skills")), false)
  assert.equal(existsSync(join(home, ".agents")), false)
})

void test("Ctrl+C at the agent prompt exits successfully without placing links", async (t) => {
  const { home, checkout } = fixture(t)
  mkdirSync(join(home, ".claude"))
  const result = await runCli(checkout, home, {
    args: ["link"],
    responses: [{ prompt: agentsPrompt, keys: cancelKeys }],
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(join(home, ".claude", "skills")), false)
})

void test("does not ask for agents named with --agent", async (t) => {
  const { home, checkout, skill } = fixture(t)
  const result = await runCli(checkout, home, {
    args: ["link", "--agent", "cursor"],
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.includes(agentsPrompt), false)
  assert.equal(realpathSync(join(home, ".cursor", "skills", "example")), skill)
})

void test("fails without detected agents instead of asking", async (t) => {
  const { home, checkout } = fixture(t)
  for (const tty of ["both", "neither"] as const) {
    const result = await runCli(checkout, home, { args: ["link"], tty })
    assert.equal(result.status, 1, result.stdout || result.stderr)
    assert.match(
      result.stderr,
      /No supported agent detected\. Name agents with --agent\./u,
    )
    assert.equal(result.stdout.includes(agentsPrompt), false)
    assert.equal(existsSync(join(home, ".claude")), false)
    assert.equal(existsSync(join(home, ".agents")), false)
  }
})
