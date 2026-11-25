import type { AgentSkillRoot } from "./agents.ts"
import { realpathIfPresent } from "./skill-files.ts"

/** Resolves configured paths and combines the reserved names for each real root. */
export async function resolveExistingAgentSkillRoots(
  configuredRoots: readonly AgentSkillRoot[],
): Promise<{
  reservedNamesByRoot: ReadonlyMap<string, ReadonlySet<string>>
  realPathsByConfiguredPath: ReadonlyMap<string, string | undefined>
  errors: unknown[]
}> {
  const reservedNamesByRoot = new Map<string, Set<string>>()
  const realPathsByConfiguredPath = new Map<string, string | undefined>()
  const errors: unknown[] = []

  for (const { path, reservedSkillNames } of configuredRoots) {
    if (!realPathsByConfiguredPath.has(path)) {
      try {
        realPathsByConfiguredPath.set(path, await realpathIfPresent(path))
      } catch (error) {
        // Record failed lookups so later checks can reuse the result.
        realPathsByConfiguredPath.set(path, undefined)
        errors.push(error)
      }
    }

    const realRoot = realPathsByConfiguredPath.get(path)
    if (realRoot === undefined) {
      continue
    }
    const reservedNames = reservedNamesByRoot.get(realRoot) ?? new Set<string>()
    for (const name of reservedSkillNames) {
      reservedNames.add(name)
    }
    reservedNamesByRoot.set(realRoot, reservedNames)
  }

  return { reservedNamesByRoot, realPathsByConfiguredPath, errors }
}
