import { homedir } from "node:os"
import { join } from "node:path"
import { readSkillsCliLock } from "./read-lock.ts"

const globalLockName = ".skill-lock.json"
const { env } = process

/** Lists the default and configured global lock locations used by the skills CLI. */
function globalSkillLockPaths(): string[] {
  const paths = [join(homedir(), ".agents", globalLockName)]
  const stateHome = env.XDG_STATE_HOME
  if (stateHome) {
    paths.push(join(stateHome, "skills", globalLockName))
  }
  return paths
}

/** Combines the global lock names and reports any lock that could not be read. */
export async function readSkillsCliGlobalLocks(): Promise<{
  names: Set<string>
  errors: unknown[]
}> {
  const names = new Set<string>()
  const errors: unknown[] = []
  for (const path of globalSkillLockPaths()) {
    try {
      for (const name of await readSkillsCliLock(path)) {
        names.add(name)
      }
    } catch (error) {
      errors.push(error)
    }
  }
  return { names, errors }
}
