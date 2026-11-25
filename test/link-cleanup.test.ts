import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, relative } from "node:path"
import { test, type TestContext } from "node:test"
import { fileURLToPath } from "node:url"

const entry = fileURLToPath(new URL("../src/skills4me.ts", import.meta.url))

/** Isolates the CLI's user-level placements in a disposable home. */
function createSandbox(t: TestContext) {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), "skills4me-link-cleanup-test-")),
  )
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const home = join(root, "home")
  mkdirSync(join(home, ".claude"), { recursive: true })
  mkdirSync(join(home, ".codex"))
  return { root, home, env: { HOME: home } }
}

/** Creates a checkout marker without invoking Git. */
function makeCheckout(directory: string) {
  mkdirSync(join(directory, ".git"), { recursive: true })
  return directory
}

/** Creates a skill directory with a regular manifest. */
function makeSkill(directory: string) {
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, "SKILL.md"), `# ${basename(directory)}\n`)
  return directory
}

/** Adds a fixture placement with its specified raw symlink target. */
function makeLink(root: string, name: string, target: string) {
  mkdirSync(root, { recursive: true })
  const placement = join(root, name)
  symlinkSync(target, placement, "dir")
  return placement
}

/** Runs the real CLI from its TypeScript source and checks for success. */
function expectLinkSuccess(cwd: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, [entry, "link"], {
    cwd,
    env,
    encoding: "utf8",
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
}

void test("rerunning link cleans renamed and incomplete skills and leaves another checkout's stale links", (t) => {
  const { root, home, env } = createSandbox(t)
  const personal = makeCheckout(join(root, "personal"))
  const work = makeCheckout(join(root, "work"))
  const old = makeSkill(join(personal, "skills", "old"))
  const incomplete = makeSkill(join(personal, "skills", "incomplete"))
  const kept = makeSkill(join(personal, "skills", "kept"))
  const other = makeSkill(join(work, "skills", "other"))
  expectLinkSuccess(personal, env)
  expectLinkSuccess(work, env)

  const renamed = join(personal, "skills", "renamed")
  renameSync(old, renamed)
  rmSync(join(incomplete, "SKILL.md"))
  const added = makeSkill(join(personal, "skills", "added"))
  rmSync(other, { recursive: true })
  expectLinkSuccess(personal, env)

  for (const placements of [
    join(home, ".claude", "skills"),
    join(home, ".agents", "skills"),
  ]) {
    assert.deepEqual(readdirSync(placements).sort(), [
      "added",
      "kept",
      "other",
      "renamed",
    ])
    assert.equal(realpathSync(join(placements, "added")), added)
    assert.equal(realpathSync(join(placements, "kept")), kept)
    assert.equal(realpathSync(join(placements, "renamed")), renamed)
    assert.equal(readlinkSync(join(placements, "other")), other)
  }
  assert.equal(existsSync(incomplete), true)
})

void test("cleans up links when skills/ disappears and when its standalone manifest is removed", (t) => {
  const { root, home, env } = createSandbox(t)
  const collection = makeCheckout(join(root, "collection"))
  const standalone = makeCheckout(join(root, "standalone"))
  makeSkill(join(collection, "skills", "last-skill"))
  const single = makeSkill(join(standalone, "skills"))
  expectLinkSuccess(collection, env)
  expectLinkSuccess(standalone, env)

  rmSync(join(collection, "skills"), { recursive: true })
  expectLinkSuccess(collection, env)
  const placements = join(home, ".claude", "skills")
  assert.deepEqual(readdirSync(placements), ["skills"])
  assert.equal(realpathSync(join(placements, "skills")), single)

  rmSync(join(single, "SKILL.md"))
  expectLinkSuccess(standalone, env)
  assert.deepEqual(readdirSync(placements), [])
  assert.equal(existsSync(single), true)
})

void test("preserves stale placements that follow external paths or point to a symlink", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = makeCheckout(join(root, "checkout"))
  const skills = join(checkout, "skills")
  const safe = makeSkill(join(skills, "safe"))
  const placements = join(home, ".claude", "skills")
  const outside = join(root, "outside")
  const intermediate = join(outside, "intermediate")
  mkdirSync(intermediate, { recursive: true })
  const removed = makeSkill(join(outside, "skills", "removed"))
  const bridge = join(checkout, "bridge")
  symlinkSync(intermediate, bridge, "dir")
  const externalTarget = `${bridge}/../skills/removed`
  const external = makeLink(placements, "external", externalTarget)
  assert.equal(realpathSync.native(external), removed)
  rmSync(removed, { recursive: true })

  const alias = join(skills, "alias")
  const aliasTarget = join(checkout, "missing")
  symlinkSync(aliasTarget, alias, "dir")
  const viaAlias = makeLink(placements, "via-alias", alias)
  makeLink(placements, "stale", join(skills, "stale"))

  expectLinkSuccess(checkout, env)

  assert.deepEqual(readdirSync(placements).sort(), [
    "external",
    "safe",
    "via-alias",
  ])
  assert.equal(readlinkSync(external), externalTarget)
  assert.equal(readlinkSync(viaAlias), alias)
  assert.equal(readlinkSync(alias), aliasTarget)
  assert.equal(realpathSync(join(placements, "safe")), safe)
})

void test("cleans stale relative links in aliased roots while preserving reserved names", (t) => {
  const { root, home, env } = createSandbox(t)
  const checkout = makeCheckout(join(root, "checkout"))
  const originals = join(checkout, "originals")
  mkdirSync(originals)
  const skills = join(checkout, "skills")
  symlinkSync(originals, skills, "dir")
  const placements = join(root, "physical-placements")
  mkdirSync(placements)
  symlinkSync(placements, join(home, ".claude", "skills"), "dir")
  symlinkSync(placements, join(home, ".codex", "skills"), "dir")

  const removedTarget = relative(placements, join(skills, "removed"))
  const keptTarget = relative(placements, join(skills, "reserved"))
  makeLink(placements, "removed", removedTarget)
  const synced = makeLink(placements, "SyNcEd", keptTarget)
  const system = makeLink(placements, ".system", keptTarget)

  expectLinkSuccess(checkout, env)

  assert.deepEqual(readdirSync(placements).sort(), [".system", "SyNcEd"])
  assert.equal(readlinkSync(synced), keptTarget)
  assert.equal(readlinkSync(system), keptTarget)
})

void test("preserves globally and locally recorded links into the shared skills CLI root", (t) => {
  const { home, env } = createSandbox(t)
  makeCheckout(home)
  const shared = join(home, ".agents", "skills")
  mkdirSync(shared, { recursive: true })
  symlinkSync(shared, join(home, "skills"), "dir")
  const placements = join(home, ".claude", "skills")
  const global = join(shared, "global-copy")
  const project = join(shared, "project-copy")
  const globalPlacement = makeLink(placements, "global-copy", global)
  const projectPlacement = makeLink(placements, "project-copy", project)
  makeLink(placements, "unrecorded", join(shared, "unrecorded"))
  writeFileSync(
    join(home, ".agents", ".skill-lock.json"),
    JSON.stringify({ version: 3, skills: { "global-copy": {} } }),
  )
  writeFileSync(
    join(home, "skills-lock.json"),
    JSON.stringify({ version: 2, skills: { "project-copy": {} } }),
  )

  expectLinkSuccess(home, env)

  assert.deepEqual(readdirSync(placements).sort(), [
    "global-copy",
    "project-copy",
  ])
  assert.equal(readlinkSync(globalPlacement), global)
  assert.equal(readlinkSync(projectPlacement), project)
})
