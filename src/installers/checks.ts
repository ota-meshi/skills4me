/** The checks and diagnostics an installer supplies for one scan. */
export type InstallChecks = {
  errors: readonly unknown[]
  /** Roots whose candidates cannot be classified, or "all" to stop the scan. */
  deferredRoots?: ReadonlySet<string> | "all"
  /** Checks records keyed by placement name before opening the skill manifest. */
  hasRecordedName?(root: string, name: string): boolean
  /** Checks records inside a directory after confirming it contains a skill. */
  hasDirectoryRecord?(directory: string): boolean | Promise<boolean>
}

/** Creates one installer's checks for the resolved agent paths. */
export type CreateInstallChecks = (
  resolvedAgentPaths: ReadonlyMap<string, string | undefined>,
) => InstallChecks | Promise<InstallChecks>
