---
name: changesets
description: Add or review a Changeset entry for a change to the released skills4me CLI. Use for changes that affect the npm package and when checking release entries before opening or updating a pull request.
---

# Changesets

[日本語](SKILL.ja.md) · [Release workflow](../../../.github/workflows/Release.yml)

Changesets versions the single npm package `skills4me`. The first publication uses the version in `package.json`.

## When to add a changeset

After the first publication, include a changeset in the same pull request as each change that calls for a new package version. Check what the CLI accepts, reports, and does. Look at commands and options, defaults, output, exit codes, skill placement and detection, and supported environments. Check internal refactors and library replacements under the bump rules below as well.

Changes limited to tests, fixtures, CI, comments, documentation, or repository skills generally need no changeset.

## Choose the bump

- `major` for breaking CLI behavior, such as removing an option or dropping a supported Node.js version.
- `minor` for a feature, a refactor, or a library replacement.
- `patch` for a bug fix, such as a crash or incorrect skill detection.

Classify the effect on `skills4me` itself. The dependency's version bump and the presence of a changeset do not determine the package's bump. Use the highest applicable bump when changes span several categories.

## Write the entry

Create `.changeset/<short-kebab-name>.md` with `skills4me` in the front matter.

```md
---
"skills4me": patch
---

Reject an empty checkout path before attempting to place links.
```

The text goes as written into the changelog and the release PR, where users read it to decide whether to upgrade.

### What one entry holds

- Write one entry for one change a user could name in one phrase. Give unrelated changes their own entries. The same fix across multiple commands is one change.
- If a later edit extends a change already recorded in an unpublished entry, update that entry.

### How it reads

- Use at most two English sentences. Start with a verb that states the change, such as `Add`, `Report`, or `Reject`. Use the second sentence when the user needs to act. For a breaking change, put the required update to the user's command or configuration first.
- Use the words a CLI user sees. Name the command, flag, or path in backticks. For output that changes, show one before-and-after example. If output changes in two directions for different inputs, give one example for each.
- Include an unchanged case only if a reader would otherwise mistake it for a regression or needs to act on it. Keep implementation or review details out of user-facing entries. When recording an internal refactor or library replacement, describe the actual change without implying a difference in CLI behavior.

## Before opening or updating a PR

When `origin/main` is available, run `npm exec -- changeset status --since=origin/main --verbose` to list the planned bump and the entries that contribute to it. With `--since`, the command picks up changeset files that are staged or committed. Read new untracked files directly. Use the PR diff to decide which changes need entries, including when the command reports that it found none.

Read the pending entries together as a changelog. Merge overlapping entries, split entries that cover unrelated changes, and check that every release-worthy change has the right bump and usable wording.
