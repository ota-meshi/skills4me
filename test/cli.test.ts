import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const entry = fileURLToPath(new URL("../src/skills4me.ts", import.meta.url))

/** Checks that invalid arguments fail with the expected CLI diagnostic. */
function expectRejection(args: string[], message: RegExp) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: tmpdir(),
    encoding: "utf8",
  })
  assert.equal(result.status, 1, JSON.stringify(args))
  assert.match(result.stderr, message)
}

void test("rejects empty or missing path values instead of treating them as omitted", () => {
  for (const args of [
    ["link", ""],
    ["adopt", "--to", ""],
    ["adopt", "--to="],
    ["adopt", "--to"],
  ]) {
    expectRejection(args, /Expected a non-empty path/)
  }
})

void test("rejects --skills-dir for link and adopt", () => {
  for (const command of ["link", "adopt"]) {
    expectRejection(
      [command, "--skills-dir", "elsewhere"],
      /Unknown option: --skills-dir/u,
    )
  }
})

void test("rejects --agent for link", () => {
  expectRejection(["link", "--agent", "claude"], /Unknown option: --agent/u)
})

void test("rejects positionals Gunshi does not consume", () => {
  for (const args of [
    ["link", "checkout", "extra"],
    ["link", "--", "extra"],
    ["detect", "extra"],
    ["adopt", "extra"],
  ]) {
    expectRejection(args, /Unexpected argument "extra"/)
  }
})

void test("requires a command token separate from option values", () => {
  expectRejection(
    ["--to", "adopt"],
    /Specify the adopt command separately from option values/,
  )
})
