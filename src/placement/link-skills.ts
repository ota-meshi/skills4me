import { mkdirSync, realpathSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import type { AgentSkillPlacement } from "../agents.ts"
import { createSkillLink, inspectPlacementPath } from "./skill-link.ts"

/** Resolves aliases through the nearest existing parent of a skill root. */
function resolvePlacementRoot(root: string): string {
  try {
    return realpathSync.native(root)
  } catch (error) {
    const parent = dirname(root)
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || parent === root) {
      throw error
    }
    return join(resolvePlacementRoot(parent), basename(root))
  }
}

/**
 * Links skills in the selected user roots and returns any placement conflicts.
 * Unexpected I/O errors stop the operation.
 */
export function linkSkills(
  skillDirectories: readonly string[],
  placements: readonly AgentSkillPlacement[],
  log: (message: string) => void,
): Error[] {
  // Collect conflicts so independent links can still be created.
  const conflicts: Error[] = []
  const reservationOwnersByPath = new Map<string, string>()
  const reportedReservations = new Set<string>()
  // Any agent root can share a physical directory with a placement root.
  for (const { displayName, primaryRoot, additionalRoots } of placements) {
    for (const { path, reservedSkillNames } of [
      primaryRoot,
      ...additionalRoots,
    ]) {
      if (reservedSkillNames.length === 0) {
        continue
      }
      const root = resolvePlacementRoot(path)
      for (const name of reservedSkillNames) {
        const reservedPath = join(root, name)
        if (!reservationOwnersByPath.has(reservedPath)) {
          reservationOwnersByPath.set(reservedPath, displayName)
        }
      }
    }
  }

  for (const placement of placements) {
    const { primaryRoot, additionalRoots } = placement
    const physicalPrimaryRoot = resolvePlacementRoot(primaryRoot.path)
    const lookupRoots = new Set([
      physicalPrimaryRoot,
      ...additionalRoots.map(({ path }) => resolvePlacementRoot(path)),
    ])
    for (const skillDirectory of skillDirectories) {
      const name = basename(skillDirectory)
      // Reservations such as Claude Code's synced apply in any casing.
      const reservedPath = join(physicalPrimaryRoot, name.toLowerCase())
      const reservedBy = reservationOwnersByPath.get(reservedPath)
      if (reservedBy !== undefined) {
        if (!reportedReservations.has(reservedPath)) {
          conflicts.push(
            new Error(`Reserved ${reservedBy} skill name: ${name}`),
          )
          reportedReservations.add(reservedPath)
        }
        continue
      }

      // Check every root for conflicts, even if a link can be reused in one.
      let hasExistingPlacement = false
      for (const root of lookupRoots) {
        const linkPath = join(root, name)
        const status = inspectPlacementPath(linkPath, skillDirectory)
        if (status === "empty") {
          continue
        }
        hasExistingPlacement = true
        if (status === "occupied") {
          conflicts.push(
            new Error(`Skill placement already exists: ${linkPath}`),
          )
        }
      }
      if (hasExistingPlacement) {
        continue
      }

      mkdirSync(primaryRoot.path, { recursive: true })
      const linkPath = join(primaryRoot.path, name)
      const status = createSkillLink(linkPath, skillDirectory)
      if (status === "created") {
        log(`Linked ${linkPath} -> ${skillDirectory}`)
      } else if (status === "occupied") {
        conflicts.push(new Error(`Skill placement already exists: ${linkPath}`))
      }
    }
  }
  return conflicts
}
