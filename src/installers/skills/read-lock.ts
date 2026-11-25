import { readFile, stat } from "node:fs/promises"
import { lstatIfPresent } from "../../skill-files.ts"

/**
 * Returns normalized directory names from a skills CLI lock.
 * A missing path supplies no names. An unreadable or malformed lock throws.
 */
export async function readSkillsCliLock(path: string): Promise<Set<string>> {
  let content: string
  try {
    const entry = await lstatIfPresent(path)
    if (!entry) {
      return new Set()
    }
    const target = entry.isSymbolicLink() ? await stat(path) : entry
    if (!target.isFile()) {
      throw new Error("expected a regular file")
    }
    content = await readFile(path, "utf8")
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not read skills CLI lock ${path}: ${reason}`, {
      cause: error,
    })
  }
  return parseSkillLock(content, path)
}

/** Checks the fields needed to recover installed names across lock versions. */
function parseSkillLock(content: string, path: string): Set<string> {
  let lock: unknown
  try {
    lock = JSON.parse(content)
  } catch (error) {
    throw new Error(`Invalid skills CLI lock ${path}: not valid JSON`, {
      cause: error,
    })
  }

  if (
    !isRecord(lock) ||
    typeof lock.version !== "number" ||
    !Number.isInteger(lock.version) ||
    lock.version < 1 ||
    !isRecord(lock.skills) ||
    !Object.values(lock.skills).every(isRecord)
  ) {
    throw new Error(
      `Invalid skills CLI lock ${path}: expected a positive integer version and a skills map of objects`,
    )
  }

  return new Set(Object.keys(lock.skills).map(placementName))
}

/** Checks for a JSON object such as a lock or a skill entry. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Uses the same directory name conversion as skills CLI v1.9.0. */
function placementName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^.0-9_a-z]+/gu, "-")
    .replace(/^[-.]+|[-.]+$/gu, "")
    .slice(0, 255)
  return sanitized || "unnamed-skill"
}
