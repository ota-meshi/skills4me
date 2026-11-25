import type { Stats } from "node:fs"
import { lstat, mkdir, mkdtemp, rename, rmdir, stat } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import type { CheckoutSkillsRoot } from "../checkout.ts"
import { confirmAdoptionCandidate } from "../detection.ts"
import {
  createSkillLink,
  inspectPlacementPath,
} from "../placement/skill-link.ts"
import { hasRegularSkillManifest, isPathWithin } from "../skill-files.ts"
import {
  prepareSkillCopy,
  publishSkillManifest,
  removeVerifiedSkillBackup,
  verifySkillCopy,
} from "./skill-copy.ts"

/** Locates a parent outside the scan roots where the original can be renamed. */
async function findBackupParent(
  source: string,
  sourceEntry: Stats,
  skillRoots: readonly string[],
): Promise<string> {
  for (let parent = dirname(source); ; parent = dirname(parent)) {
    if (!skillRoots.some((root) => isPathWithin(root, parent))) {
      if ((await stat(parent)).dev !== sourceEntry.dev) {
        throw new Error(
          `No backup location on the original filesystem for ${source}.`,
        )
      }
      return parent
    }
    if (dirname(parent) === parent) {
      break
    }
  }
  throw new Error(
    `No backup location outside the agent skill roots for ${source}.`,
  )
}

/** Confirms the same physical directory is still present during cutover. */
function assertSameSkillDirectory(
  path: string,
  current: Stats,
  expected: Stats,
): void {
  if (
    !current.isDirectory() ||
    current.dev !== expected.dev ||
    current.ino !== expected.ino
  ) {
    throw new Error(`The original skill directory changed: ${path}`)
  }
}

/** Copies a skill, confirms the copy, and replaces its original placement with a link. */
export async function adoptSkill(
  source: string,
  skillsRoot: CheckoutSkillsRoot,
  log: (message: string) => void,
): Promise<void> {
  const { entry: originalEntry, skillRoots } =
    await confirmAdoptionCandidate(source)
  const name = basename(source)
  const destination = join(skillsRoot.path, name)
  if (isPathWithin(source, destination)) {
    throw new Error(
      `Adoption destination is inside the original skill: ${destination}`,
    )
  }
  if (await hasRegularSkillManifest(skillsRoot.path)) {
    throw new Error(
      `The checkout's skills directory is a standalone skill: ${skillsRoot.path}`,
    )
  }
  if (!skillsRoot.exists) {
    await mkdir(skillsRoot.path)
  }

  // Reserve only an unused destination. The manifest stays hidden until verification.
  await mkdir(destination, { mode: 0o700 })
  log(`Copying to ${destination}`)
  const manifestPath = await prepareSkillCopy(source, destination)

  const backupParent = await findBackupParent(source, originalEntry, skillRoots)
  const backupRoot = await mkdtemp(join(backupParent, ".skills4me-adopt-"))
  const backupPath = join(backupRoot, name)
  log(`Original backup: ${backupPath}`)
  try {
    // An installer may have claimed this skill while its files were being copied.
    const { entry: currentEntry } = await confirmAdoptionCandidate(source)
    assertSameSkillDirectory(source, currentEntry, originalEntry)
    await rename(source, backupPath)
  } catch (error) {
    // Remove only the empty container when the original could not be moved.
    await rmdir(backupRoot).catch(() => undefined)
    throw error
  }

  // Keep the backup recoverable until the copy matches and the original path leads to it.
  try {
    assertSameSkillDirectory(backupPath, await lstat(backupPath), originalEntry)
    const rootPermissions = await verifySkillCopy(
      backupPath,
      destination,
      manifestPath,
    )
    await publishSkillManifest(destination, manifestPath, rootPermissions)
    if (
      createSkillLink(source, destination) === "occupied" ||
      inspectPlacementPath(source, destination) !== "linked"
    ) {
      throw new Error(`Could not link the original placement: ${source}`)
    }
    await removeVerifiedSkillBackup(backupPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${message}\nOriginal backup location: ${backupPath}`, {
      cause: error,
    })
  }
  await rmdir(backupRoot)
  log(`Adopted ${source} -> ${destination}`)
}
