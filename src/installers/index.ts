import type { CreateInstallChecks } from "./checks.ts"
import { createOpenskillsInstallChecks } from "./openskills.ts"
import { createSkillsCliInstallChecks } from "./skills/checks.ts"

/** The factories that supply installer checks for each scan. */
export const installCheckFactories: readonly CreateInstallChecks[] = [
  createSkillsCliInstallChecks,
  createOpenskillsInstallChecks,
]
