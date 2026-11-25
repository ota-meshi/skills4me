import type { Stats } from "node:fs"
import { lstat, realpath } from "node:fs/promises"
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path"

/** Checks whether a resolved path is the root or is inside it. */
export function isPathWithin(root: string, path: string): boolean {
  const fromRoot = relative(root, path)
  return (
    fromRoot !== ".." &&
    !fromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(fromRoot)
  )
}

/** Checks for a regular skill manifest without following a symlink. */
export async function hasRegularSkillManifest(
  directory: string,
): Promise<boolean> {
  return (await lstatIfPresent(join(directory, "SKILL.md")))?.isFile() ?? false
}

/** Reads the entry itself and treats only a missing entry as absent. */
export async function lstatIfPresent(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined
    }
    throw error
  }
}

/** Resolves an existing path, including a directory reached through a symlink. */
export async function realpathIfPresent(
  path: string,
): Promise<string | undefined> {
  try {
    return await realpath(path)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined
    }
    throw error
  }
}

/** Resolves a path even when its final components are missing. */
export async function resolvePathFromExistingParent(
  path: string,
): Promise<string | undefined> {
  if (await lstatIfPresent(path)) {
    // A dangling symlink occupies this path and leaves its destination unknown.
    return realpathIfPresent(path)
  }
  const parent = dirname(path)
  const name = basename(path)
  if (parent === path || name === "." || name === "..") {
    return undefined
  }
  const resolvedParent = await resolvePathFromExistingParent(parent)
  return resolvedParent === undefined ? undefined : join(resolvedParent, name)
}
