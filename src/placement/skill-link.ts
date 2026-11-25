import { lstatSync, realpathSync, symlinkSync } from "node:fs"
import { platform } from "node:os"

/** Checks whether a placement path is empty, already linked, or occupied. */
export function inspectPlacementPath(
  linkPath: string,
  skillDirectory: string,
): "empty" | "linked" | "occupied" {
  const entry = lstatSync(linkPath, { throwIfNoEntry: false })
  if (!entry) {
    return "empty"
  }
  if (entry.isSymbolicLink()) {
    try {
      // Resolve symlinks before interpreting any '..' in their target paths.
      if (realpathSync.native(linkPath) === skillDirectory) {
        return "linked"
      }
    } catch {
      // An unresolvable link still occupies the placement path.
    }
  }
  return "occupied"
}

/** Links to an absolute skill path or reports the entry occupying the placement. */
export function createSkillLink(
  linkPath: string,
  skillDirectory: string,
): "created" | "linked" | "occupied" {
  // Match the skills CLI's Windows directory links.
  const linkType = platform() === "win32" ? "junction" : "dir"
  try {
    symlinkSync(skillDirectory, linkPath, linkType)
    return "created"
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error
    }
    return inspectPlacementPath(linkPath, skillDirectory) === "linked"
      ? "linked"
      : "occupied"
  }
}
