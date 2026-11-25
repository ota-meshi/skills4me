import assert from "node:assert/strict"
import fs from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import os from "node:os"
import { resolve } from "node:path"
import { test } from "node:test"
import { createSkillLink } from "../src/placement/skill-link.ts"

void test("uses a junction pointing to the absolute skill path on Windows", (t) => {
  t.mock.method(os, "platform", () => "win32")
  const symlink = t.mock.method(fs, "symlinkSync", () => undefined)
  syncBuiltinESMExports()
  t.after(() => {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  })

  const original = resolve("checkout", "skills", "example")
  const placement = resolve("user-skills", "example")
  assert.equal(createSkillLink(placement, original), "created")
  assert.equal(symlink.mock.callCount(), 1)
  assert.deepEqual(symlink.mock.calls[0].arguments, [
    original,
    placement,
    "junction",
  ])
})
