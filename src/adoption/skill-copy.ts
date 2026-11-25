import { createHash, randomUUID } from "node:crypto"
import { constants, createReadStream, type Stats } from "node:fs"
import {
  chmod,
  copyFile,
  link,
  lstat,
  mkdir,
  readdir,
  readlink,
  realpath,
  rm,
  symlink,
  unlink,
} from "node:fs/promises"
import { basename, join } from "node:path"
import { checkRelativeSkillLinks } from "./relative-links.ts"

const manifestName = "SKILL.md"

type SkillEntry =
  | { path: string; kind: "directory"; mode: number }
  | { path: string; kind: "file"; mode: number }
  | { path: string; kind: "symlink"; target: Buffer }

/** Returns permission bits without the filesystem entry type. */
function permissions(entry: Stats): number {
  return entry.mode & 0o7777
}

/** Lists entries in parent-before-child order without following symlinks. */
async function readSkillEntries(
  root: string,
  directory = "",
): Promise<SkillEntry[]> {
  const entries: SkillEntry[] = []
  for (const name of await readdir(join(root, directory))) {
    const path = join(directory, name)
    const fullPath = join(root, path)
    const entry = await lstat(fullPath)
    if (entry.isDirectory()) {
      entries.push({ path, kind: "directory", mode: permissions(entry) })
      for (const child of await readSkillEntries(root, path)) {
        entries.push(child)
      }
    } else if (entry.isFile()) {
      entries.push({ path, kind: "file", mode: permissions(entry) })
    } else if (entry.isSymbolicLink()) {
      const target = await readlink(fullPath, { encoding: "buffer" })
      entries.push({ path, kind: "symlink", target })
    } else {
      throw new Error(`Unsupported entry in skill: ${fullPath}`)
    }
  }
  return entries
}

/** Copies a skill into its reserved destination and returns the private manifest path. */
export async function prepareSkillCopy(
  source: string,
  destination: string,
): Promise<string> {
  const entries = await readSkillEntries(source)
  if (
    !entries.some(({ kind, path }) => kind === "file" && path === manifestName)
  ) {
    throw new Error(`Skill has no regular ${manifestName}: ${source}`)
  }
  const symlinks = new Map(
    entries
      .filter((entry) => entry.kind === "symlink")
      .map(({ path, target }) => [path, target]),
  )
  const manifestPath = join(destination, `.${manifestName}-${randomUUID()}`)
  for (const entry of entries) {
    const path =
      entry.path === manifestName ? manifestPath : join(destination, entry.path)
    if (entry.kind === "directory") {
      await mkdir(path, { mode: 0o700 })
    } else if (entry.kind === "file") {
      await copyFile(join(source, entry.path), path, constants.COPYFILE_EXCL)
      await chmod(path, entry.mode)
    } else {
      await symlink(entry.target, path)
    }
  }
  // Finish directory permissions after all their children have been created.
  for (const entry of entries.toReversed()) {
    if (entry.kind === "directory") {
      await chmod(join(destination, entry.path), entry.mode)
    }
  }
  await checkRelativeSkillLinks(
    await realpath(source),
    await realpath(destination),
    symlinks,
  )
  return manifestPath
}

/** Hashes a file without requiring its entire contents to fit in memory. */
async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
  }
  return hash.digest("hex")
}

/** Compares entry metadata and, for regular files, the contents. */
async function matchesCopiedEntry(
  expected: SkillEntry,
  actual: SkillEntry,
  sourcePath: string,
  copyPath: string,
): Promise<boolean> {
  if (expected.kind === "symlink") {
    return actual.kind === "symlink" && expected.target.equals(actual.target)
  }
  if (actual.kind !== expected.kind || expected.mode !== actual.mode) {
    return false
  }
  return (
    expected.kind === "directory" ||
    (await hashFile(sourcePath)) === (await hashFile(copyPath))
  )
}

/** Compares the actual copy with the staged source, returning its root permissions. */
export async function verifySkillCopy(
  source: string,
  destination: string,
  manifestPath: string,
): Promise<number> {
  const sourceRoot = await lstat(source)
  if (!sourceRoot.isDirectory() || !(await lstat(destination)).isDirectory()) {
    throw new Error(
      `Expected skill directories at ${source} and ${destination}.`,
    )
  }

  const sourceEntries = await readSkillEntries(source)
  const copyByPath = new Map(
    (await readSkillEntries(destination)).map((entry) => [entry.path, entry]),
  )
  const pendingManifest = copyByPath.get(basename(manifestPath))
  if (pendingManifest?.kind !== "file" || copyByPath.has(manifestName)) {
    throw new Error(`Manifest staging changed in ${destination}.`)
  }
  copyByPath.delete(pendingManifest.path)
  copyByPath.set(manifestName, pendingManifest)
  if (copyByPath.size !== sourceEntries.length) {
    throw new Error(`Skill contents changed during adoption: ${source}`)
  }

  for (const expected of sourceEntries) {
    const actual = copyByPath.get(expected.path)
    const sourcePath = join(source, expected.path)
    if (
      !actual ||
      !(await matchesCopiedEntry(
        expected,
        actual,
        sourcePath,
        join(destination, actual.path),
      ))
    ) {
      throw new Error(`Skill entry changed during adoption: ${sourcePath}`)
    }
  }
  return permissions(sourceRoot)
}

/** Publishes the verified manifest without overwriting and restores root permissions. */
export async function publishSkillManifest(
  destination: string,
  manifestPath: string,
  rootPermissions: number,
): Promise<void> {
  if (!(await lstat(manifestPath)).isFile()) {
    throw new Error(
      `Staged skill manifest is not a regular file: ${manifestPath}`,
    )
  }
  await link(manifestPath, join(destination, manifestName))
  await unlink(manifestPath)
  await chmod(destination, rootPermissions)
}

/** Makes verified backup directories writable for recursive removal. */
async function allowBackupRemoval(path: string): Promise<void> {
  const entry = await lstat(path)
  if (!entry.isDirectory()) {
    throw new Error(
      `Expected a directory in the verified skill backup: ${path}`,
    )
  }
  const mode = permissions(entry)
  if ((mode & 0o200) === 0) {
    await chmod(path, mode | 0o200)
  }
  for (const child of await readdir(path, { withFileTypes: true })) {
    if (child.isDirectory()) {
      await allowBackupRemoval(join(path, child.name))
    }
  }
}

/** Removes the redundant backup after its verified replacement is in use. */
export async function removeVerifiedSkillBackup(path: string): Promise<void> {
  await allowBackupRemoval(path)
  await rm(path, { recursive: true })
}
