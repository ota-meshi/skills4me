import { join } from "node:path"
import { lstatIfPresent } from "../skill-files.ts"
import type { InstallChecks } from "./checks.ts"

/** Creates the check for openskills markers inside skill directories. */
export function createOpenskillsInstallChecks(): InstallChecks {
  return {
    errors: [],
    /** Checks whether openskills recorded an install in this skill directory. */
    async hasDirectoryRecord(directory) {
      return (
        (await lstatIfPresent(join(directory, ".openskills.json"))) !==
        undefined
      )
    },
  }
}
