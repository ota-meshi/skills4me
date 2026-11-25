import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, relative, resolve } from "node:path"
import { test, type TestContext } from "node:test"
import { fileURLToPath } from "node:url"

const entry = fileURLToPath(new URL("../src/skills4me.ts", import.meta.url))

/** Isolates user configuration and placements in a temporary home. */
function createSandbox(t: TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "skills4me-link-")))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const home = join(root, "home")
  mkdirSync(home)
  return { root, home, env: { HOME: home } }
}

/** Creates an ordinary skill directory with a readable original. */
function makeSkill(directory: string) {
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, "SKILL.md"), `# ${basename(directory)}\n`)
  return directory
}

/** Invokes the actual CLI from its TypeScript source without a build. */
function runLink(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) {
  const result = spawnSync(process.execPath, [entry, "link", ...args], {
    cwd,
    env,
    encoding: "utf8",
  })
  assert.ifError(result.error)
  return result
}

/** Checks the symlink target directly as well as the original it resolves to. */
function assertDirectLink(placement: string, source: string) {
  assert.equal(resolve(dirname(placement), readlinkSync(placement)), source)
  assert.equal(realpathSync(placement), source)
}

void test("links from a nested directory and keeps placements from both checkouts", (t) => {
  const { root, home, env } = createSandbox(t)
  const personal = join(root, "personal")
  const nested = join(personal, "notes", "drafts")
  const work = join(root, "work")
  mkdirSync(nested, { recursive: true })
  mkdirSync(join(personal, ".git"))
  const first = makeSkill(join(personal, "skills", "first"))
  const second = makeSkill(join(work, "skills", "second"))
  writeFileSync(join(work, ".git"), "gitdir: /unused/worktree-metadata\n")
  const workAlias = join(root, "work-alias")
  symlinkSync(work, workAlias, "dir")

  mkdirSync(join(home, ".codex"))
  const fromNested = runLink(nested, env)
  assert.equal(fromNested.status, 0, fromNested.stderr)
  const fromAlias = runLink(root, env, join(workAlias, "skills"))
  assert.equal(fromAlias.status, 0, fromAlias.stderr)

  const firstLink = join(home, ".agents", "skills", "first")
  assertDirectLink(firstLink, first)
  assertDirectLink(join(home, ".agents", "skills", "second"), second)
  assert.equal(existsSync(join(home, ".claude")), false)
  writeFileSync(join(firstLink, "SKILL.md"), "# Edited through the link\n")
  assert.equal(
    readFileSync(join(first, "SKILL.md"), "utf8"),
    "# Edited through the link\n",
  )
})

void test("recognizes CODEX_HOME and reuses links in the aliased skill root", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = join(root, "checkout")
  const original = makeSkill(join(checkout, "skills", "one"))
  mkdirSync(join(checkout, ".git"))
  const codexHome = join(root, "agent-config", "codex")
  mkdirSync(codexHome, { recursive: true })
  const codexEnv = { ...env, CODEX_HOME: ` ${codexHome} ` }
  const firstRun = runLink(checkout, codexEnv)
  assert.equal(firstRun.status, 0, firstRun.stderr)
  const primary = join(home, ".agents", "skills")
  const placement = join(primary, "one")
  assertDirectLink(placement, original)

  const next = makeSkill(join(checkout, "skills", "two"))
  symlinkSync(primary, join(codexHome, "skills"), "dir")
  const relativeTarget = relative(primary, original)
  rmSync(placement)
  symlinkSync(relativeTarget, placement, "dir")
  const secondRun = runLink(checkout, codexEnv)
  assert.equal(secondRun.status, 0, secondRun.stderr)
  assert.equal(readlinkSync(placement), relativeTarget)
  assertDirectLink(join(primary, "two"), next)
  assert.equal(realpathSync(join(codexHome, "skills", "two")), next)
  assert.equal(existsSync(join(home, ".claude")), false)
})

void test("uses system Codex configuration when present", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = join(root, "checkout")
  const original = makeSkill(join(checkout, "skills", "one"))
  mkdirSync(join(checkout, ".git"))

  const result = runLink(checkout, env)
  if (existsSync("/etc/codex")) {
    assert.equal(result.status, 0, result.stderr)
    assertDirectLink(join(home, ".agents", "skills", "one"), original)
  } else {
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /No supported agent detected\./u)
    assert.equal(existsSync(join(home, ".agents")), false)
  }
  assert.equal(existsSync(join(home, ".claude")), false)
})

void test("links to both detected installations", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = join(root, "checkout")
  const original = makeSkill(join(checkout, "skills", "one"))
  const claudeLink = join(home, ".claude", "skills", "one")
  const codexLink = join(home, ".agents", "skills", "one")
  mkdirSync(join(checkout, ".git"))
  mkdirSync(join(home, ".claude"))
  mkdirSync(join(home, ".codex"))

  const result = runLink(checkout, env)
  assert.equal(result.status, 0, result.stderr)
  assertDirectLink(claudeLink, original)
  assertDirectLink(codexLink, original)
})

void test("reuses relative links and skips the Claude reserved name", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = join(root, "checkout")
  const original = makeSkill(join(checkout, "skills", "shared"))
  const reserved = makeSkill(join(checkout, "skills", "SyNcEd"))
  mkdirSync(join(checkout, ".git"))

  const claudeConfig = join(root, "claude-config")
  const claudeSkills = join(claudeConfig, "skills")
  mkdirSync(claudeSkills, { recursive: true })
  mkdirSync(join(home, ".codex"))
  const claudeLink = join(claudeSkills, "shared")
  const target = relative(claudeSkills, original)
  symlinkSync(target, claudeLink, "dir")
  const existingInode = lstatSync(claudeLink).ino

  const result = runLink(checkout, {
    ...env,
    CLAUDE_CONFIG_DIR: ` ${claudeConfig} `,
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /SyNcEd/u)
  assert.equal(readlinkSync(claudeLink), target)
  assert.equal(lstatSync(claudeLink).ino, existingInode)
  assert.equal(existsSync(join(claudeSkills, "SyNcEd")), false)
  assert.equal(existsSync(join(home, ".claude")), false)
  assertDirectLink(join(home, ".agents", "skills", "shared"), original)
  assertDirectLink(join(home, ".agents", "skills", "SyNcEd"), reserved)
})

void test("keeps the Claude reserved name when both detected agents share a new skill root", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = join(root, "checkout")
  const sharedParent = join(home, ".agents")
  const shared = join(sharedParent, "skills")
  mkdirSync(join(checkout, ".git"), { recursive: true })
  mkdirSync(sharedParent)
  mkdirSync(join(home, ".codex"))
  symlinkSync(sharedParent, join(home, ".claude"), "dir")
  makeSkill(join(checkout, "skills", "synced"))

  const result = runLink(checkout, env)
  assert.notEqual(result.status, 0)
  assert.equal(
    result.stderr.trim(),
    "skills4me: Reserved Claude Code skill name: synced",
  )
  assert.equal(existsSync(join(shared, "synced")), false)
})

void test("respects a Codex compatibility reservation in Claude's placement root", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = join(root, "checkout")
  const claudeConfig = join(home, ".claude")
  const codexConfigAlias = join(root, "codex-config")
  mkdirSync(join(checkout, ".git"), { recursive: true })
  mkdirSync(claudeConfig)
  symlinkSync(claudeConfig, codexConfigAlias, "dir")
  const reserved = makeSkill(join(checkout, "skills", ".system"))
  const ordinary = makeSkill(join(checkout, "skills", "ordinary"))

  const result = runLink(checkout, { ...env, CODEX_HOME: codexConfigAlias })

  assert.equal(result.status, 1, result.stderr)
  assert.equal(
    result.stderr.trim(),
    "skills4me: Reserved Codex skill name: .system",
  )
  const claudeSkills = join(claudeConfig, "skills")
  const codexSkills = join(home, ".agents", "skills")
  assert.equal(existsSync(join(claudeSkills, ".system")), false)
  assertDirectLink(join(codexSkills, ".system"), reserved)
  assertDirectLink(join(claudeSkills, "ordinary"), ordinary)
  assertDirectLink(join(codexConfigAlias, "skills", "ordinary"), ordinary)
  assert.equal(existsSync(join(codexSkills, "ordinary")), false)
})

void test("reports external collisions and still creates independent links", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = join(root, "checkout")
  const claudeSkills = join(home, ".claude", "skills")
  const codexHome = join(root, "codex-home")
  const codexCompatibility = join(codexHome, "skills")
  mkdirSync(join(checkout, ".git"), { recursive: true })
  makeSkill(join(checkout, "skills", "collision"))
  const safe = makeSkill(join(checkout, "skills", "safe"))
  const reused = makeSkill(join(checkout, "skills", "reused"))
  const copied = makeSkill(join(claudeSkills, "collision"))
  writeFileSync(join(copied, "SKILL.md"), "# External copy\n")
  const external = makeSkill(join(root, "external"))
  mkdirSync(codexCompatibility, { recursive: true })
  const externalLink = join(codexCompatibility, "collision")
  symlinkSync(external, externalLink, "dir")
  const existing = join(codexCompatibility, "reused")
  const existingTarget = relative(codexCompatibility, reused)
  symlinkSync(existingTarget, existing, "dir")

  const result = runLink(checkout, { ...env, CODEX_HOME: codexHome })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /collision/u)
  assert.equal(
    readFileSync(join(copied, "SKILL.md"), "utf8"),
    "# External copy\n",
  )
  assertDirectLink(externalLink, external)
  assert.equal(readlinkSync(existing), existingTarget)
  assertDirectLink(join(claudeSkills, "safe"), safe)
  assertDirectLink(join(home, ".agents", "skills", "safe"), safe)
  assert.equal(existsSync(join(home, ".agents", "skills", "collision")), false)
  assert.equal(existsSync(join(home, ".agents", "skills", "reused")), false)
})

void test("discovers only immediate real skill directories in checkout/skills", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = makeSkill(join(root, "checkout"))
  const skills = join(checkout, "skills")
  const nested = makeSkill(join(skills, "nested"))
  mkdirSync(join(checkout, ".git"))
  makeSkill(join(checkout, "elsewhere"))
  makeSkill(join(skills, "incomplete", "deeper"))
  symlinkSync(nested, join(skills, "alias"), "dir")
  mkdirSync(join(home, ".claude"))
  const claudeSkills = join(home, ".claude", "skills")

  const result = runLink(nested, env)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readdirSync(claudeSkills), ["nested"])
  assertDirectLink(join(claudeSkills, "nested"), nested)
})

void test("links checkout/skills itself when it contains SKILL.md", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = join(root, "checkout")
  const standalone = makeSkill(join(checkout, "skills"))
  makeSkill(join(standalone, "child"))
  mkdirSync(join(checkout, ".git"))
  mkdirSync(join(home, ".claude"))
  const claudeSkills = join(home, ".claude", "skills")

  const result = runLink(checkout, env)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readdirSync(claudeSkills), ["skills"])
  assertDirectLink(join(claudeSkills, "skills"), standalone)
})

void test("handles missing skills, missing checkouts, and skills linked outside", (t) => {
  const { root, home, env } = createSandbox(t)
  const outside = makeSkill(join(root, "outside"))
  const checkout = join(root, "checkout")
  mkdirSync(join(checkout, ".git"), { recursive: true })
  mkdirSync(join(home, ".claude"))

  const noCheckout = runLink(outside, env)
  assert.notEqual(noCheckout.status, 0)
  assert.match(noCheckout.stderr, /No Git checkout/u)

  const noSkills = runLink(checkout, env)
  assert.equal(noSkills.status, 0, noSkills.stderr)

  symlinkSync(outside, join(checkout, "skills"), "dir")
  const escape = runLink(checkout, env)
  assert.notEqual(escape.status, 0)
  assert.match(escape.stderr, /outside the Git checkout/u)
  assert.equal(existsSync(join(home, ".claude", "skills")), false)
  assert.equal(existsSync(join(home, ".agents")), false)
})
