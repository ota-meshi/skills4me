import { basename, dirname, isAbsolute, join, sep } from "node:path"
import {
  lstatIfPresent,
  realpathIfPresent,
  resolvePathFromExistingParent,
} from "../skill-files.ts"

/** Returns the resolved path of a stale target in the checkout's skills scope. */
export async function findStaleLinkTarget(
  rawTarget: string,
  placementRoot: string,
  checkoutSkillsRoot: string,
): Promise<string | undefined> {
  // Keep dot segments intact until the filesystem has resolved preceding symlinks.
  const absoluteTarget = isAbsolute(rawTarget)
    ? rawTarget
    : `${placementRoot}${sep}${rawTarget}`
  // Strip trailing separators so lstat can inspect a symlink at the final component.
  const targetPath = absoluteTarget.replace(
    sep === "\\" ? /[/\\]+$/u : /\/+$/u,
    "",
  )
  const targetName = basename(targetPath)
  if (!targetName || targetName === "." || targetName === "..") {
    return undefined
  }

  // Inspect the final entry itself so a dangling target symlink stays in place.
  const targetEntry = await lstatIfPresent(targetPath)
  if (targetEntry && !targetEntry.isDirectory()) {
    return undefined
  }

  let resolvedTargetPath: string | undefined
  if (targetEntry) {
    resolvedTargetPath = await realpathIfPresent(targetPath)
  } else {
    const resolvedParent = await resolvePathFromExistingParent(
      dirname(targetPath),
    )
    resolvedTargetPath =
      resolvedParent === undefined
        ? undefined
        : join(resolvedParent, targetName)
  }
  if (
    resolvedTargetPath === undefined ||
    (resolvedTargetPath !== checkoutSkillsRoot &&
      dirname(resolvedTargetPath) !== checkoutSkillsRoot)
  ) {
    return undefined
  }

  // Only a missing directory or missing manifest establishes a stale target.
  if (
    targetEntry &&
    (await lstatIfPresent(join(resolvedTargetPath, "SKILL.md")))
  ) {
    return undefined
  }
  return resolvedTargetPath
}
