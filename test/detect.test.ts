import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { test, type TestContext } from "node:test"
import { fileURLToPath } from "node:url"

const entry = fileURLToPath(new URL("../src/skills4me.ts", import.meta.url))

/** Isolates the scanned paths from the host's agent configuration. */
function createSandbox(t: TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "skills4me-detect-")))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const home = join(root, "home")
  mkdirSync(home)
  return { root, home, env: { HOME: home } }
}

/** Creates a real skill directory with a regular manifest. */
function makeSkill(directory: string) {
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, "SKILL.md"), `# ${basename(directory)}\n`)
  return directory
}

/** Writes an installer record into the disposable home or state directory. */
function writeRecord(path: string, record: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(record))
}

/** Invokes the actual CLI from its TypeScript source without a build. */
function runDetect(cwd: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, [entry, "detect"], {
    cwd,
    env,
    encoding: "utf8",
  })
  assert.ifError(result.error)
  return result
}

/** Checks exact path lines without requiring a particular result order. */
function assertCandidates(stdout: string, candidates: readonly string[]) {
  const lines = stdout.split("\n")
  assert.equal(lines.pop(), "")
  assert.deepEqual(lines.sort(), candidates.toSorted())
}

void test("detect prints nothing and creates no directories when roots are absent", (t) => {
  const { root, home, env } = createSandbox(t)

  const result = runDetect(root, env)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, "")
  assert.equal(result.stderr, "")
  assert.deepEqual(readdirSync(home), [])
})

void test("detect still reports readable roots when an agent root cannot be resolved", (t) => {
  const { root, home, env } = createSandbox(t)
  const config = join(root, "custom-claude")
  const candidate = makeSkill(join(config, "skills", "own-skill"))
  mkdirSync(join(home, ".codex"))
  symlinkSync("skills", join(home, ".codex", "skills"), "dir")

  const result = runDetect(root, { ...env, CLAUDE_CONFIG_DIR: config })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /\.codex\/skills/u)
  assertCandidates(result.stdout, [candidate])
})

void test("detect lists real skills in every user root and skips symlinks and reserved paths", (t) => {
  const { root, home, env } = createSandbox(t)
  const claude = join(home, ".claude", "skills")
  const codex = join(home, ".agents", "skills")
  const legacy = join(root, "custom-codex", "skills")
  const candidates = [
    makeSkill(join(claude, "ordinary skill")),
    makeSkill(join(codex, "shared")),
    makeSkill(join(legacy, "legacy")),
  ]
  const outside = makeSkill(join(root, "external"))
  symlinkSync(outside, join(claude, "linked-skill"), "dir")
  mkdirSync(join(claude, "linked-manifest"))
  symlinkSync(
    join(outside, "SKILL.md"),
    join(claude, "linked-manifest", "SKILL.md"),
    "file",
  )
  mkdirSync(join(codex, "manifest-directory", "SKILL.md"), { recursive: true })
  makeSkill(join(codex, "container", "nested-skill"))
  makeSkill(join(claude, "SyNcEd"))
  makeSkill(join(legacy, ".system"))

  const result = runDetect(root, { ...env, CODEX_HOME: dirname(legacy) })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, "")
  assertCandidates(result.stdout, candidates)
})

void test("detect scans an aliased root once and keeps both agents' reservations", (t) => {
  const { root, home, env } = createSandbox(t)
  const shared = join(home, ".agents", "skills")
  const candidate = makeSkill(join(shared, "local"))
  makeSkill(join(shared, "synced"))
  makeSkill(join(shared, ".system"))
  mkdirSync(join(home, ".claude"))
  mkdirSync(join(home, ".codex"))
  symlinkSync(shared, join(home, ".claude", "skills"), "dir")
  symlinkSync(shared, join(home, ".codex", "skills"), "dir")

  const result = runDetect(root, env)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, "")
  assertCandidates(result.stdout, [candidate])
})

void test("detect applies both global locks by installed directory name", (t) => {
  const { root, home, env } = createSandbox(t)
  const claude = join(home, ".claude", "skills")
  const codex = join(home, ".agents", "skills")
  const legacy = join(home, ".codex", "skills")
  const state = join(root, "xdg-state")
  const globalEntry = {
    source: "example/skills",
    sourceType: "github",
    sourceUrl: "https://github.com/example/skills",
    skillFolderHash: "",
    installedAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  }
  writeRecord(join(home, ".agents", ".skill-lock.json"), {
    version: 3,
    skills: { "--Global Lock Copy!": globalEntry },
  })
  writeRecord(join(state, "skills", ".skill-lock.json"), {
    version: 3,
    skills: { "after-rename": { ...globalEntry, skillName: "before-rename" } },
  })
  makeSkill(join(claude, "global-lock-copy"))
  makeSkill(join(codex, "global-lock-copy"))
  makeSkill(join(legacy, "after-rename"))
  const unrelated = makeSkill(join(legacy, "before-rename"))

  const result = runDetect(root, { ...env, XDG_STATE_HOME: state })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, "")
  assertCandidates(result.stdout, [unrelated])
})

void test("detect applies the home project lock only to physically matching roots and the openskills record only to its directory", (t) => {
  const { root, home, env } = createSandbox(t)
  const claude = join(home, ".claude", "skills")
  const codex = join(home, ".agents", "skills")
  const legacy = join(home, ".codex", "skills")
  const customClaude = join(root, "custom-claude")
  makeSkill(join(claude, "project-copy"))
  makeSkill(join(codex, "project-copy"))
  const unrelated = makeSkill(join(legacy, "project-copy"))
  const marked = makeSkill(join(claude, "same-name"))
  const unmarked = makeSkill(join(codex, "same-name"))
  mkdirSync(customClaude)
  symlinkSync(claude, join(customClaude, "skills"), "dir")
  writeRecord(join(marked, ".openskills.json"), {})
  writeRecord(join(home, "skills-lock.json"), {
    version: 2,
    skills: {
      "project-copy": {
        source: "example/skills",
        sourceType: "github",
        computedHash: "",
        installMode: "copy",
      },
    },
  })

  const result = runDetect(root, { ...env, CLAUDE_CONFIG_DIR: customClaude })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, "")
  assertCandidates(result.stdout, [unrelated, unmarked])
})

void test("detect scans other agents' roots and applies the home project lock where the skills CLI installs", (t) => {
  const { root, home, env } = createSandbox(t)
  const kiro = join(home, ".kiro", "skills")
  const cursor = join(home, ".cursor", "skills")
  makeSkill(join(kiro, "project-copy"))
  const candidates = [
    makeSkill(join(kiro, "own-skill")),
    makeSkill(join(cursor, "project-copy")),
  ]
  writeRecord(join(home, "skills-lock.json"), {
    version: 1,
    skills: { "project-copy": {} },
  })

  const result = runDetect(root, env)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, "")
  assertCandidates(result.stdout, candidates)
})

void test("detect reports invalid or unreadable locks and prints candidates only from unaffected roots", (t) => {
  const { root, home, env } = createSandbox(t)
  makeSkill(join(home, ".claude", "skills", "claude"))
  makeSkill(join(home, ".agents", "skills", "codex"))
  const unaffected = makeSkill(join(home, ".codex", "skills", "legacy"))
  writeFileSync(join(home, "skills-lock.json"), "{")

  const partial = runDetect(root, env)
  assert.equal(partial.status, 1)
  assert.match(partial.stderr, /skills-lock\.json/u)
  assertCandidates(partial.stdout, [unaffected])

  const globalLock = join(home, ".agents", ".skill-lock.json")
  writeRecord(globalLock, {
    version: 3,
    skills: [],
  })
  const blocked = runDetect(root, env)
  assert.equal(blocked.status, 1)
  assert.match(blocked.stderr, /\.skill-lock\.json/u)
  assert.equal(blocked.stdout, "")

  rmSync(globalLock)
  mkdirSync(globalLock)
  const unreadable = runDetect(root, env)
  assert.equal(unreadable.status, 1)
  assert.match(unreadable.stderr, /\.skill-lock\.json/u)
  assert.equal(unreadable.stdout, "")
})
