import { homedir } from "node:os"
import { join } from "node:path"
import { realpathIfPresent } from "../../skill-files.ts"
import { readSkillsCliLock } from "./read-lock.ts"

/** The agent roots covered by ~/skills-lock.json and the result of reading it. */
type HomeProjectSkillLock = {
  coveredRoots: ReadonlySet<string>
  /** Undefined when the lock could not be read or parsed. */
  names: ReadonlySet<string> | undefined
  errors: unknown[]
}

/** Reads installed names from the skills CLI project lock in the home directory. */
export function readSkillsCliHomeProjectNames(
  home: string,
): Promise<ReadonlySet<string>> {
  return readSkillsCliLock(join(home, "skills-lock.json"))
}

/** Reads ~/skills-lock.json when an agent root overlaps a home project install path. */
export async function readSkillsCliHomeProjectLock(
  resolvedAgentPaths: ReadonlyMap<string, string | undefined>,
): Promise<HomeProjectSkillLock> {
  const home = homedir()
  // These are the project install paths used by the skills CLI from home.
  const installPaths = [
    join(home, ".claude", "skills"),
    join(home, ".agents", "skills"),
  ]
  const agentRoots = new Set(resolvedAgentPaths.values())
  const coveredRoots = new Set<string>()
  const errors: unknown[] = []
  for (const path of installPaths) {
    try {
      const root = resolvedAgentPaths.has(path)
        ? resolvedAgentPaths.get(path)
        : await realpathIfPresent(path)
      if (root !== undefined && agentRoots.has(root)) {
        coveredRoots.add(root)
      }
    } catch (error) {
      errors.push(error)
    }
  }

  if (coveredRoots.size === 0) {
    return { coveredRoots, names: new Set(), errors }
  }
  try {
    const names = await readSkillsCliHomeProjectNames(home)
    return { coveredRoots, names, errors }
  } catch (error) {
    return { coveredRoots, names: undefined, errors: [...errors, error] }
  }
}
