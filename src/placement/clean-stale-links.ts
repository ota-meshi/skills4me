import { readdir, readlink, unlink } from "node:fs/promises"
import { join } from "node:path"
import { resolveExistingAgentSkillRoots } from "../agent-skill-roots.ts"
import type { AgentSkillRoot } from "../agents.ts"
import { isSkillsCliSharedTargetProtected } from "../installers/skills/shared-target.ts"
import { findStaleLinkTarget } from "./stale-link-target.ts"

/** Checks whether a stale link is in scope and can be removed. */
async function canRemoveStaleLink(
  rawTarget: string,
  placementRoot: string,
  checkoutSkillsRoot: string,
): Promise<boolean> {
  try {
    const staleTarget = await findStaleLinkTarget(
      rawTarget,
      placementRoot,
      checkoutSkillsRoot,
    )
    return (
      staleTarget !== undefined &&
      !(await isSkillsCliSharedTargetProtected(staleTarget))
    )
  } catch {
    // An unreadable path leaves the link's ownership or staleness uncertain.
    return false
  }
}

/** Reads a placement link's target as a lossless UTF-8 path. */
async function readPlacementLinkTarget(
  path: string,
): Promise<string | undefined> {
  try {
    const bytes = await readlink(path, { encoding: "buffer" })
    const target = bytes.toString()
    // Real-path resolution requires a lossless UTF-8 representation.
    return Buffer.from(target).equals(bytes) ? target : undefined
  } catch {
    // Leave placements alone if their targets cannot be read.
    return undefined
  }
}

/** Cleans stale links in the selected roots and returns any cleanup errors. */
export async function cleanStaleSkillLinks(
  checkoutSkillsRoot: string,
  configuredRoots: readonly AgentSkillRoot[],
  log: (message: string) => void,
): Promise<unknown[]> {
  const { reservedNamesByRoot, errors } =
    await resolveExistingAgentSkillRoots(configuredRoots)
  for (const [placementRoot, reservedNames] of reservedNamesByRoot) {
    try {
      for (const entry of await readdir(placementRoot, {
        withFileTypes: true,
      })) {
        if (
          !entry.isSymbolicLink() ||
          reservedNames.has(entry.name.toLowerCase())
        ) {
          continue
        }
        const linkPath = join(placementRoot, entry.name)
        const rawTarget = await readPlacementLinkTarget(linkPath)
        if (
          rawTarget === undefined ||
          !(await canRemoveStaleLink(
            rawTarget,
            placementRoot,
            checkoutSkillsRoot,
          ))
        ) {
          continue
        }

        try {
          await unlink(linkPath)
          log(`Removed stale link ${linkPath} -> ${rawTarget}`)
        } catch (error) {
          errors.push(error)
        }
      }
    } catch (error) {
      errors.push(error)
    }
  }
  return errors
}
