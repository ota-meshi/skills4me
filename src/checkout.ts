import { readdir, realpath } from "node:fs/promises"
import { dirname, join } from "node:path"
import {
  hasRegularSkillManifest,
  isPathWithin,
  lstatIfPresent,
} from "./skill-files.ts"

/** Resolved location and presence of a checkout's skills directory. */
export interface CheckoutSkillsRoot {
  /** The physical path if it exists, or the location where skills/ can be created. */
  readonly path: string
  readonly exists: boolean
}

/** Finds the nearest checkout, or returns undefined when there is none. */
export async function findCheckout(
  directory: string,
): Promise<string | undefined> {
  let current = await realpath(directory)
  for (;;) {
    const marker = await lstatIfPresent(join(current, ".git"))
    if (marker?.isDirectory() || marker?.isFile()) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return undefined
    }
    current = parent
  }
}

/** Resolves skills/ within the checkout, retaining its path when absent. */
export async function resolveCheckoutSkillsRoot(
  checkout: string,
): Promise<CheckoutSkillsRoot> {
  const path = join(checkout, "skills")
  if (!(await lstatIfPresent(path))) {
    return { path, exists: false }
  }

  const resolvedPath = await realpath(path)
  if (!isPathWithin(checkout, resolvedPath)) {
    throw new Error(
      `Skill directory is outside the Git checkout: ${resolvedPath}.`,
    )
  }
  return { path: resolvedPath, exists: true }
}

/** Finds a standalone skill at the root or skills in its immediate subdirectories. */
export async function findSkillDirectories(
  skillsRoot: string,
): Promise<string[]> {
  if (await hasRegularSkillManifest(skillsRoot)) {
    return [skillsRoot]
  }

  const skillDirectories: string[] = []
  for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
    const directory = join(skillsRoot, entry.name)
    if (entry.isDirectory() && (await hasRegularSkillManifest(directory))) {
      skillDirectories.push(directory)
    }
  }
  return skillDirectories
}
