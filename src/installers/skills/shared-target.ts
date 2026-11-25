import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { resolvePathFromExistingParent } from "../../skill-files.ts"
import { readSkillsCliGlobalLocks } from "./global-lock.ts"
import { readSkillsCliHomeProjectNames } from "./home-project-lock.ts"

/** Decides whether the skills CLI lock records protect a shared link target. */
export async function isSkillsCliSharedTargetProtected(
  target: string,
): Promise<boolean> {
  const home = homedir()
  const sharedPath = join(home, ".agents", "skills")
  const sharedRoot = await resolvePathFromExistingParent(sharedPath)
  if (sharedRoot === undefined || dirname(target) !== sharedRoot) {
    return false
  }

  // Both lock types cover this shared directory and record the target name.
  const name = basename(target)
  const globalLocks = await readSkillsCliGlobalLocks()
  if (globalLocks.errors.length > 0 || globalLocks.names.has(name)) {
    return true
  }

  try {
    const homeProjectNames = await readSkillsCliHomeProjectNames(home)
    return homeProjectNames.has(name)
  } catch {
    // An unreadable lock could still cover this target.
    return true
  }
}
