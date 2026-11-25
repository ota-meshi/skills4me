import type { InstallChecks } from "../checks.ts"
import { readSkillsCliGlobalLocks } from "./global-lock.ts"
import { readSkillsCliHomeProjectLock } from "./home-project-lock.ts"

/** Creates name checks from the skills CLI's global and home project locks. */
export async function createSkillsCliInstallChecks(
  resolvedAgentPaths: ReadonlyMap<string, string | undefined>,
): Promise<InstallChecks> {
  const globalLocks = await readSkillsCliGlobalLocks()
  if (globalLocks.errors.length > 0) {
    return { errors: globalLocks.errors, deferredRoots: "all" }
  }

  const homeLock = await readSkillsCliHomeProjectLock(resolvedAgentPaths)
  return {
    errors: homeLock.errors,
    deferredRoots:
      homeLock.names === undefined ? homeLock.coveredRoots : undefined,
    /** Matches a placement name against the locks that apply to its root. */
    hasRecordedName(root, name) {
      return (
        globalLocks.names.has(name) ||
        (homeLock.coveredRoots.has(root) && homeLock.names?.has(name) === true)
      )
    },
  }
}
