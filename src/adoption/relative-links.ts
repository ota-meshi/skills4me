import { basename, dirname, isAbsolute, join, relative, sep } from "node:path"
import {
  isPathWithin,
  realpathIfPresent,
  resolvePathFromExistingParent,
} from "../skill-files.ts"

/** Maps a resolved path in the original skill to its destination path. */
function relocatePath(
  path: string,
  source: string,
  destination: string,
): string {
  return isPathWithin(source, path)
    ? join(destination, relative(source, path))
    : path
}

/** Finds a known in-skill alias when its own target cannot yet be resolved. */
async function findInternalAlias(
  root: string,
  target: string,
  links: ReadonlyMap<string, Buffer>,
): Promise<string | undefined> {
  const parent = await realpathIfPresent(dirname(target))
  if (parent === undefined) {
    return undefined
  }
  const name = relative(root, join(parent, basename(target)))
  return links.has(name) ? name : undefined
}

/** Compares relative link targets while the original and hidden copy both exist. */
export async function checkRelativeSkillLinks(
  source: string,
  destination: string,
  links: ReadonlyMap<string, Buffer>,
): Promise<void> {
  for (const [linkPath, bytes] of links) {
    const target = bytes.toString()
    if (isAbsolute(target)) {
      continue
    }
    const sourceLink = join(source, linkPath)
    const copiedLink = join(destination, linkPath)
    try {
      if (!Buffer.from(target).equals(bytes)) {
        throw new Error("target path contains non-UTF-8 bytes")
      }
      const originalPath = `${dirname(sourceLink)}${sep}${target}`
      const copiedPath = `${dirname(copiedLink)}${sep}${target}`
      const originalTarget = await resolvePathFromExistingParent(originalPath)
      const copiedTarget = await resolvePathFromExistingParent(copiedPath)
      if (originalTarget !== undefined && copiedTarget !== undefined) {
        // Both paths will reach the copy if they refer to the original skill.
        if (
          relocatePath(originalTarget, source, destination) ===
          relocatePath(copiedTarget, source, destination)
        ) {
          continue
        }
      } else if (copiedTarget === undefined) {
        // The same internal alias is checked at its own link entry. It may
        // be dangling because the copy's manifest has not been published.
        const copiedAlias = await findInternalAlias(
          destination,
          copiedPath,
          links,
        )
        if (
          copiedAlias !== undefined &&
          copiedAlias === (await findInternalAlias(source, originalPath, links))
        ) {
          continue
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Cannot check relative symlink ${sourceLink}: ${reason}`,
        {
          cause: error,
        },
      )
    }
    throw new Error(
      `Adoption would change or cannot resolve the target of relative symlink ${sourceLink}.`,
    )
  }
}
