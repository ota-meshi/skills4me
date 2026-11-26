# skills4me

[日本語](README.ja.md)

A CLI for managing user-level Agent Skills across projects in Claude Code, Codex, Cursor, Gemini CLI, and other coding agents.

Requires Node.js 22 or later.

Run `npx skills4me` in an interactive terminal to open the command menu.

## Link skills from a checkout

You can use separate Git checkouts for personal and work skills without registering them or setting up a central library.

Put each skill in `skills/<name>/` with its `SKILL.md` and any supporting files. A checkout with a single skill can use `skills/SKILL.md` directly. Run this from the checkout.

```sh
npx skills4me link
```

The command links each skill into the selected agents' user-level skill directories. In an interactive terminal, it lists every supported agent and preselects the detected ones. In a noninteractive run, it uses all detected agents. Run it in each checkout you want to use, and rerun it after adding, renaming, or removing skills. Edits through the links update the files in your checkout. Existing same-name skills are kept, and conflicts are reported.

To skip the agent prompt, use `npx skills4me link --agent claude-code --agent cursor`. You can name agents that were not detected. Run `npx skills4me link --help` for the list of names you can pass to `--agent`.

Use `npx skills4me link <directory>` to specify a checkout. If you omit the path outside a checkout, an interactive terminal lets you choose one.

## Bring a skill into Git

Run `npx skills4me detect` to preview candidates. It skips links. A third-party skill without a recognized record can still appear, so review the list before choosing a skill.

From the destination checkout, run the following in an interactive terminal and choose a skill.

```sh
npx skills4me adopt
```

`adopt` moves the entire skill into the checkout's `skills/` directory and leaves a link at its original path. Commit the new files in Git as usual. Use `--to <directory>` to select the checkout from elsewhere.

`detect` and `adopt` also accept `--agent` to search only the named agents' skill directories.

For help, run `npx skills4me --help`.
