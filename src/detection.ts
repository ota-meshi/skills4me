import type { Stats } from "node:fs"
import { readdir } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { resolveExistingAgentSkillRoots } from "./agent-skill-roots.ts"
import { agentNames, agentSkillPlacement } from "./agents.ts"
import type { InstallChecks } from "./installers/checks.ts"
import { installCheckFactories } from "./installers/index.ts"
import { hasRegularSkillManifest, lstatIfPresent } from "./skill-files.ts"

/** Checks directory-local records after the directory is known to be a skill. */
async function hasDirectoryInstallRecord(
  directory: string,
  installerChecks: readonly InstallChecks[],
): Promise<boolean> {
  for (const checks of installerChecks) {
    if (await checks.hasDirectoryRecord?.(directory)) {
      return true
    }
  }
  return false
}

/** Resolves the user roots and loads installer records for one check. */
async function loadCandidateChecks() {
  const configuredRoots = agentNames.flatMap((agent) => {
    const { primaryRoot, additionalRoots } = agentSkillPlacement(agent)
    return [primaryRoot, ...additionalRoots]
  })
  // Keep configured paths and their real paths so installers can match aliases.
  const {
    reservedNamesByRoot,
    realPathsByConfiguredPath,
    errors: rootErrors,
  } = await resolveExistingAgentSkillRoots(configuredRoots)
  // Load shared installer records once and reuse them for every candidate.
  const installerChecks = await Promise.all(
    installCheckFactories.map(async (createChecks) =>
      createChecks(realPathsByConfiguredPath),
    ),
  )
  return { reservedNamesByRoot, installerChecks, rootErrors }
}

/** Checks whether an installer failure leaves this root's eligibility unknown. */
function defersRoot(checks: InstallChecks, root: string): boolean {
  const { deferredRoots } = checks
  return deferredRoots === "all" || deferredRoots?.has(root) === true
}

/** Checks a real directory for reservations, installer records, and a manifest. */
async function isCandidateDirectory(
  directory: string,
  reservedNames: ReadonlySet<string>,
  installerChecks: readonly InstallChecks[],
): Promise<boolean> {
  const root = dirname(directory)
  const name = basename(directory)
  // Name records can rule out a placement before reading files in the skill.
  if (
    reservedNames.has(name.toLowerCase()) ||
    installerChecks.some((checks) => checks.hasRecordedName?.(root, name))
  ) {
    return false
  }

  // Confirm a regular SKILL.md before checking directory-local markers.
  return (
    (await hasRegularSkillManifest(directory)) &&
    !(await hasDirectoryInstallRecord(directory, installerChecks))
  )
}

/** Finds adoption candidates and reports any checks that could not be completed. */
export async function detectSkills(): Promise<{
  candidates: string[]
  errors: unknown[]
}> {
  const { reservedNamesByRoot, installerChecks, rootErrors } =
    await loadCandidateChecks()
  // A failure reading records that cover every root blocks the entire scan.
  const blockingChecks = installerChecks.filter(
    ({ deferredRoots }) => deferredRoots === "all",
  )
  if (blockingChecks.length > 0) {
    return {
      candidates: [],
      errors: blockingChecks.flatMap(({ errors }) => errors),
    }
  }
  const candidates: string[] = []
  const errors = [
    ...rootErrors,
    ...installerChecks.flatMap((checks) => checks.errors),
  ]

  for (const [root, reservedNames] of reservedNamesByRoot) {
    // A scoped record failure leaves the other roots available to scan.
    if (installerChecks.some((checks) => defersRoot(checks, root))) {
      continue
    }
    try {
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue
        }
        const directory = join(root, entry.name)
        if (
          await isCandidateDirectory(directory, reservedNames, installerChecks)
        ) {
          candidates.push(directory)
        }
      }
    } catch (error) {
      errors.push(error)
    }
  }

  return { candidates: candidates.sort(), errors }
}

/** Rechecks one detected skill and returns its directory entry and the current roots. */
export async function confirmAdoptionCandidate(directory: string): Promise<{
  entry: Stats
  skillRoots: readonly string[]
}> {
  const { reservedNamesByRoot, installerChecks } = await loadCandidateChecks()
  const root = dirname(directory)
  const reservedNames = reservedNamesByRoot.get(root)
  if (
    reservedNames === undefined ||
    join(root, basename(directory)) !== directory
  ) {
    throw new Error(
      `Skill is outside the current agent skill roots: ${directory}`,
    )
  }

  const blockingChecks = installerChecks.filter((checks) =>
    defersRoot(checks, root),
  )
  if (blockingChecks.length > 0) {
    throw new AggregateError(
      blockingChecks.flatMap(({ errors }) => errors),
      `Could not confirm adoption eligibility for ${directory}`,
    )
  }

  const entry = await lstatIfPresent(directory)
  if (
    !entry?.isDirectory() ||
    !(await isCandidateDirectory(directory, reservedNames, installerChecks))
  ) {
    throw new Error(`Skill is no longer eligible for adoption: ${directory}`)
  }

  return { entry, skillRoots: [...reservedNamesByRoot.keys()] }
}
