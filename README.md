# skills4me

[日本語](README.ja.md)

A CLI for using skills from local Git checkouts in Claude Code and Codex. It can also bring unmanaged skills into a checkout you choose.

Requires Node.js 22 or later.

Run `npx skills4me` in an interactive terminal to open the command menu.

## Link skills from a checkout

Put each skill in `skills/<name>/` with its `SKILL.md` and any supporting files. A checkout with a single skill can use `skills/SKILL.md` directly. Run this from the checkout.

```sh
npx skills4me link
```

The command links each skill for all detected agents. Run it in each checkout you want to use, and rerun it after adding, renaming, or removing skills. Edits through the links update the files in your checkout. Existing same-name skills are kept, and conflicts are reported.

Use `npx skills4me link <directory>` to specify a checkout. If you omit the path outside a checkout, an interactive terminal lets you choose one.

## Bring a skill into Git

To preview candidates, run `npx skills4me detect`. The list excludes links and skills recorded by the `skills` CLI or `openskills`.

From the destination checkout, run the following in an interactive terminal and choose a skill.

```sh
npx skills4me adopt
```

`adopt` moves the entire skill into the checkout's `skills/` directory and leaves a link at its original path. Commit the new files in Git as usual. Use `--to <directory>` to select the checkout from elsewhere.

For help, run `npx skills4me --help`.
