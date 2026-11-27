import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, relative, resolve } from "node:path"
import { test, type TestContext } from "node:test"
import { fileURLToPath } from "node:url"
import { stripVTControlCharacters } from "node:util"

const entry = fileURLToPath(new URL("../src/skills4me.ts", import.meta.url))
const adoptPrompt = "Select a skill to adopt."

type AdoptOptions = {
  to?: string
  agents?: readonly string[]
  keys?: string
  interactive?: boolean
  setup?: string
  onPrompt?: () => void
}

/** Isolates the user's skill roots and the target Git checkout. */
function createSandbox(t: TestContext) {
  // Match the CLI's real paths, which expand Windows short names such as RUNNER~1.
  const root = realpathSync.native(
    mkdtempSync(join(tmpdir(), "skills4me-adopt-")),
  )
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const home = join(root, "home")
  const checkout = join(root, "checkout")
  mkdirSync(home)
  mkdirSync(join(checkout, ".git"), { recursive: true })
  return { root, home, checkout }
}

/** Creates a real skill directory with a regular manifest. */
function makeSkill(directory: string) {
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, "SKILL.md"), `# ${basename(directory)}\n`)
  return directory
}

/** Runs the source CLI and sends keystrokes only after the real Clack prompt. */
async function runAdopt(
  cwd: string,
  home: string,
  {
    to,
    agents = [],
    keys,
    interactive = true,
    setup = "",
    onPrompt,
  }: AdoptOptions = {},
) {
  const preload = `data:text/javascript,${encodeURIComponent(`
    ${setup}
    process.stdin.isTTY = ${interactive};
    process.stdin.setRawMode = () => process.stdin;
    process.stdout.isTTY = ${interactive};
    process.stdout.columns = 240;
  `)}`
  const argumentsForAdopt = [
    ...(to === undefined ? [] : ["--to", to]),
    ...agents.flatMap((agent) => ["--agent", agent]),
  ]
  const child = spawn(
    process.execPath,
    ["--import", preload, entry, "adopt", ...argumentsForAdopt],
    {
      cwd,
      // Windows reads the home directory from USERPROFILE instead of HOME.
      env: { HOME: home, USERPROFILE: home },
      timeout: 10_000,
    },
  )
  const closed = once(child, "close")
  let stdout = ""
  let stderr = ""
  let answered = false
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk
    if (keys !== undefined && !answered && stdout.includes(adoptPrompt)) {
      answered = true
      onPrompt?.()
      child.stdin.end(keys)
    }
  })
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk
  })
  if (keys === undefined) {
    child.stdin.end()
  }

  const [status, signal] = await closed
  stdout = stripVTControlCharacters(stdout)
  assert.equal(signal, null, stderr || stdout)
  return { status, stdout, stderr }
}

/** Reads the original's recovery path as displayed by the CLI. */
function reportedBackupPath(stdout: string): string {
  const path = /^Original backup: (.+)$/mu.exec(stdout)?.[1]
  assert.ok(path, stdout)
  return path
}

/** Installs a competing entry after the CLI moves the source into its backup. */
function replaceSourceAfterStaging(
  source: string,
  replacement: { contents: string } | { target: string },
): string {
  const createEntry =
    "contents" in replacement
      ? `await fs.writeFile(from, ${JSON.stringify(replacement.contents)}, { flag: "wx" });`
      : `await fs.symlink(${JSON.stringify(replacement.target)}, from, "dir");`
  return `
    import fs from "node:fs/promises";
    import { syncBuiltinESMExports } from "node:module";
    const { rename } = fs;
    fs.rename = async (from, to) => {
      await rename(from, to);
      if (from === ${JSON.stringify(source)}) {
        ${createEntry}
      }
    };
    syncBuiltinESMExports();
  `
}

void test("adopts into the checkout selected by --to and keeps the full skill usable", async (t) => {
  const { root, home, checkout } = createSandbox(t)
  const source = makeSkill(join(home, ".claude", "skills", "example"))
  const destination = join(checkout, "skills", "example")
  const nested = join(checkout, "notes")
  const sourceScripts = join(source, "scripts")
  const copiedScripts = join(destination, "scripts")
  mkdirSync(nested)
  mkdirSync(sourceScripts)
  mkdirSync(join(source, "references"))
  const script = "#!/bin/sh\nexit 0\n"
  writeFileSync(join(sourceScripts, "run.sh"), script)
  chmodSync(join(sourceScripts, "run.sh"), 0o755)
  const notes = "Reference content.\n"
  writeFileSync(join(source, "references", "notes.md"), notes)
  // Windows stores symlink targets with backslashes.
  const relativeLink = join("..", "references", "notes.md")
  symlinkSync(relativeLink, join(sourceScripts, "notes"), "file")
  chmodSync(sourceScripts, 0o555)

  const directoriesToClean = [sourceScripts, copiedScripts]
  try {
    const result = await runAdopt(root, home, { to: nested, keys: "\r" })
    const backup = reportedBackupPath(result.stdout)
    directoriesToClean.push(join(backup, "scripts"))

    assert.equal(result.status, 0, result.stderr)
    assert.ok(result.stdout.includes(checkout), result.stdout)
    assert.ok(
      result.stdout.indexOf(adoptPrompt) > result.stdout.indexOf(checkout),
    )
    assert.ok(result.stdout.includes(source), result.stdout)
    assert.equal(resolve(dirname(source), readlinkSync(source)), destination)
    assert.equal(
      readFileSync(join(destination, "SKILL.md"), "utf8"),
      "# example\n",
    )
    assert.equal(readFileSync(join(copiedScripts, "run.sh"), "utf8"), script)
    // Windows mode bits reflect only the read-only attribute.
    if (process.platform === "win32") {
      assert.equal(statSync(copiedScripts).mode & 0o222, 0)
    } else {
      assert.equal(statSync(join(copiedScripts, "run.sh")).mode & 0o111, 0o111)
      assert.equal(statSync(copiedScripts).mode & 0o777, 0o555)
    }
    assert.equal(readlinkSync(join(copiedScripts, "notes")), relativeLink)
    assert.equal(readFileSync(join(sourceScripts, "notes"), "utf8"), notes)
    assert.equal(existsSync(dirname(backup)), false)
  } finally {
    // The original, copy, or backup can still have read-only fixture directories.
    for (const directory of directoriesToClean) {
      if (existsSync(directory)) {
        chmodSync(directory, 0o755)
      }
    }
  }
})

void test("Ctrl+C at the adoption prompt leaves the original and destination alone", async (t) => {
  const { home, checkout } = createSandbox(t)
  const source = makeSkill(join(home, ".agents", "skills", "example"))

  const result = await runAdopt(checkout, home, { keys: "\u0003" })

  assert.equal(result.status, 0, result.stderr)
  assert.ok(result.stdout.includes(adoptPrompt), result.stdout)
  assert.equal(lstatSync(source).isDirectory(), true)
  assert.equal(readFileSync(join(source, "SKILL.md"), "utf8"), "# example\n")
  assert.equal(existsSync(join(checkout, "skills")), false)
})

void test("rejects a noninteractive invocation and preserves an occupied destination", async (t) => {
  const { home, checkout } = createSandbox(t)
  const source = makeSkill(join(home, ".claude", "skills", "example"))
  const destination = makeSkill(join(checkout, "skills", "example"))
  const existing = "# Existing destination\n"
  writeFileSync(join(destination, "SKILL.md"), existing)

  const noninteractive = await runAdopt(checkout, home, { interactive: false })
  assert.equal(noninteractive.status, 1)
  assert.match(noninteractive.stderr, /interactive|terminal/iu)
  assert.doesNotMatch(noninteractive.stdout, /Select a skill to adopt/u)

  const collision = await runAdopt(checkout, home, { keys: "\r" })
  assert.equal(collision.status, 1)
  assert.match(collision.stderr, /already exists|eexist|occupied/iu)
  assert.equal(lstatSync(source).isDirectory(), true)
  assert.equal(readFileSync(join(source, "SKILL.md"), "utf8"), "# example\n")
  assert.equal(readFileSync(join(destination, "SKILL.md"), "utf8"), existing)
})

void test("rejects adoption without a checkout or through an external or standalone skill root", async (t) => {
  const { root, home, checkout } = createSandbox(t)
  const source = makeSkill(join(home, ".claude", "skills", "example"))
  const outside = join(root, "outside")
  mkdirSync(outside)

  const noCheckout = await runAdopt(checkout, home, { to: outside, keys: "\r" })
  assert.equal(noCheckout.status, 1)
  assert.match(noCheckout.stderr, /git checkout/iu)

  const skills = join(checkout, "skills")
  symlinkSync(outside, skills, "dir")
  const external = await runAdopt(checkout, home, { keys: "\r" })
  assert.equal(external.status, 1)
  assert.match(external.stderr, /outside.*checkout/iu)
  assert.equal(existsSync(join(outside, "example")), false)

  rmSync(skills)
  mkdirSync(skills)
  const changed = await runAdopt(checkout, home, {
    keys: "\r",
    /** Replaces the selected checkout's skills directory before confirmation. */
    onPrompt() {
      rmSync(skills, { recursive: true })
      symlinkSync(outside, skills, "dir")
    },
  })
  assert.equal(changed.status, 1)
  assert.match(changed.stderr, /outside.*checkout/iu)
  assert.equal(readlinkSync(skills), outside)
  assert.deepEqual(readdirSync(outside), [])

  rmSync(skills)
  makeSkill(skills)
  const standalone = await runAdopt(checkout, home, { keys: "\r" })
  assert.equal(standalone.status, 1)
  assert.match(standalone.stderr, /standalone|skill\.md/iu)
  assert.equal(readFileSync(join(skills, "SKILL.md"), "utf8"), "# skills\n")
  assert.equal(existsSync(join(skills, "example")), false)
  assert.equal(lstatSync(source).isDirectory(), true)
})

void test("leaves a skill with an installer record out of the adoption choices", async (t) => {
  const { home, checkout } = createSandbox(t)
  const managed = makeSkill(join(home, ".claude", "skills", "managed"))
  writeFileSync(join(managed, ".openskills.json"), "{}")

  const empty = await runAdopt(checkout, home)
  assert.equal(empty.status, 0, empty.stderr)
  assert.doesNotMatch(empty.stdout, /Select a skill to adopt/u)
  assert.equal(existsSync(join(checkout, "skills")), false)

  const candidate = makeSkill(join(home, ".claude", "skills", "example"))
  const result = await runAdopt(checkout, home, { keys: "\r" })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(result.stdout.includes(candidate), result.stdout)
  assert.equal(result.stdout.includes(managed), false)
  assert.equal(lstatSync(managed).isDirectory(), true)
  assert.equal(existsSync(join(checkout, "skills", "managed")), false)
  assert.equal(realpathSync(candidate), join(checkout, "skills", "example"))
})

void test("offers only the skills of the agents named with --agent", async (t) => {
  const { home, checkout } = createSandbox(t)
  const other = makeSkill(join(home, ".claude", "skills", "other"))
  const candidate = makeSkill(join(home, ".cursor", "skills", "example"))

  const result = await runAdopt(checkout, home, {
    agents: ["cursor"],
    keys: "\r",
  })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(result.stdout.includes(candidate), result.stdout)
  assert.equal(result.stdout.includes(other), false)
  assert.equal(realpathSync(candidate), join(checkout, "skills", "example"))
})

void test("rejects moving a skill whose external relative link would point elsewhere", async (t) => {
  const { home, checkout } = createSandbox(t)
  const source = makeSkill(join(home, ".claude", "skills", "example"))
  const shared = join(home, ".claude", "shared.txt")
  writeFileSync(shared, "External reference.\n")
  const link = join(source, "reference")
  const rawTarget = relative(source, shared)
  symlinkSync(rawTarget, link, "file")

  const result = await runAdopt(checkout, home, { keys: "\r" })

  assert.equal(result.status, 1)
  assert.ok(result.stderr.includes(link), result.stderr)
  assert.equal(readlinkSync(link), rawTarget)
  assert.equal(realpathSync(link), shared)
  assert.equal(lstatSync(source).isDirectory(), true)
  assert.equal(
    existsSync(join(checkout, "skills", "example", "SKILL.md")),
    false,
  )
})

void test("a new installer record during copying prevents moving the original", async (t) => {
  const { home, checkout } = createSandbox(t)
  const source = makeSkill(join(home, ".claude", "skills", "example"))
  const manifest = join(source, "SKILL.md")
  const lock = join(home, ".agents", ".skill-lock.json")
  const setup = `
    import fs from "node:fs/promises";
    import { syncBuiltinESMExports } from "node:module";
    const { copyFile } = fs;
    fs.copyFile = async (from, to, flags) => {
      await copyFile(from, to, flags);
      if (from === ${JSON.stringify(manifest)}) {
        await fs.mkdir(${JSON.stringify(dirname(lock))}, { recursive: true });
        await fs.writeFile(${JSON.stringify(lock)}, JSON.stringify({ version: 3, skills: { example: {} } }));
      }
    };
    syncBuiltinESMExports();
  `

  const result = await runAdopt(checkout, home, { keys: "\r", setup })

  assert.equal(result.status, 1)
  assert.equal(existsSync(lock), true)
  assert.equal(lstatSync(source).isDirectory(), true)
  assert.equal(readFileSync(manifest, "utf8"), "# example\n")
  assert.equal(
    existsSync(join(checkout, "skills", "example", "SKILL.md")),
    false,
  )
  const backup = reportedBackupPath(result.stdout)
  assert.equal(existsSync(dirname(backup)), false)
})

void test("link skips the copy while its manifest is unpublished, even if copying fails", async (t) => {
  const { root, home, checkout } = createSandbox(t)
  const source = makeSkill(join(home, ".claude", "skills", "example"))
  const manifest = join(source, "SKILL.md")
  const linkProbe = join(root, "link-probe.json")
  mkdirSync(join(home, ".codex"))
  const setup = `
    import fs from "node:fs/promises";
    import { spawnSync } from "node:child_process";
    import { syncBuiltinESMExports } from "node:module";
    const { copyFile } = fs;
    fs.copyFile = async (from, to, flags) => {
      await copyFile(from, to, flags);
      if (from === ${JSON.stringify(manifest)}) {
        const { status, stderr } = spawnSync(process.execPath, [${JSON.stringify(entry)}, "link"], {
          cwd: ${JSON.stringify(checkout)}, encoding: "utf8",
        });
        await fs.writeFile(${JSON.stringify(linkProbe)}, JSON.stringify({ status, stderr }));
        throw new Error("Injected copy failure.");
      }
    };
    syncBuiltinESMExports();
  `

  const result = await runAdopt(checkout, home, { keys: "\r", setup })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Injected copy failure/u)
  assert.deepEqual(JSON.parse(readFileSync(linkProbe, "utf8")), {
    status: 0,
    stderr: "",
  })
  assert.equal(existsSync(join(home, ".agents", "skills", "example")), false)
  assert.equal(
    existsSync(join(checkout, "skills", "example", "SKILL.md")),
    false,
  )
  assert.equal(lstatSync(source).isDirectory(), true)
  assert.equal(readFileSync(manifest, "utf8"), "# example\n")
})

void test("preserves the staged original and a new source-path occupant when switching fails", async (t) => {
  const { home, checkout } = createSandbox(t)
  const source = makeSkill(join(home, ".claude", "skills", "example"))
  const replacement = "Created by another tool.\n"
  const notes = "Original reference.\n"
  writeFileSync(join(source, "reference.txt"), notes)
  const setup = replaceSourceAfterStaging(source, { contents: replacement })

  const result = await runAdopt(checkout, home, { keys: "\r", setup })

  assert.equal(result.status, 1)
  const backup = reportedBackupPath(result.stdout)
  assert.ok(relative(dirname(source), backup).startsWith(".."), backup)
  assert.ok(result.stderr.includes(backup), result.stderr)
  assert.equal(readFileSync(join(backup, "SKILL.md"), "utf8"), "# example\n")
  assert.equal(readFileSync(join(backup, "reference.txt"), "utf8"), notes)
  assert.equal(lstatSync(source).isFile(), true)
  assert.equal(readFileSync(source, "utf8"), replacement)
})

void test("reuses a competing symlink only when it resolves to the adopted skill", async (t) => {
  for (const matchesDestination of [true, false]) {
    const { root, home, checkout } = createSandbox(t)
    const source = makeSkill(join(home, ".claude", "skills", "example"))
    const destination = join(checkout, "skills", "example")
    let target = relative(dirname(source), destination)
    let expectedTarget = destination
    if (!matchesDestination) {
      const outside = join(root, "outside")
      const nested = join(outside, "nested")
      mkdirSync(nested, { recursive: true })
      const portal = join(checkout, "portal")
      symlinkSync(nested, portal, "dir")
      expectedTarget = makeSkill(join(outside, "skills", "example"))
      target = `${portal}/../skills/example`
    }
    const setup = replaceSourceAfterStaging(source, { target })

    const result = await runAdopt(checkout, home, { keys: "\r", setup })

    assert.equal(result.status, matchesDestination ? 0 : 1, result.stderr)
    assert.equal(readlinkSync(source), target)
    assert.equal(realpathSync.native(source), expectedTarget)
    const backup = reportedBackupPath(result.stdout)
    assert.equal(existsSync(backup), !matchesDestination)
  }
})
