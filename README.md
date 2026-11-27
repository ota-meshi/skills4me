# skills4me

[![npm version](https://img.shields.io/npm/v/skills4me.svg)](https://www.npmjs.com/package/skills4me)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[日本語](README.ja.md)

**Keep your own Agent Skills in Git and use them in all your coding agents.**

skills4me links the skills in your Git checkouts into the user-level skill directories of Claude Code, Codex, Cursor, Gemini CLI, and 70+ other coding agents.

- **Edit in place.** Agents read your checkout through links, so edits apply without reinstalling.
- **One command for every agent.** `link` places each skill for all the agents you choose.
- **No setup.** No config file, registry, or central library. Keep personal and work skills in separate checkouts.
- **Bring existing skills into Git.** `adopt` moves a skill from an agent's directory into your checkout and leaves a link behind.

## Quick start

Requires Node.js 22 or later.

Put each skill in `skills/<name>/` in a Git checkout.

```text
my-skills/
└── skills/
    ├── commit-message/
    │   └── SKILL.md
    └── review-pr/
        ├── SKILL.md
        └── checklist.md
```

Run this from the checkout.

```sh
npx skills4me link
```

Choose agents from the list, where the detected ones are preselected. Each skill is linked into their skill directories.

```text
Linked ~/.claude/skills/commit-message -> ~/my-skills/skills/commit-message
Linked ~/.claude/skills/review-pr -> ~/my-skills/skills/review-pr
Linked ~/.agents/skills/commit-message -> ~/my-skills/skills/commit-message
Linked ~/.agents/skills/review-pr -> ~/my-skills/skills/review-pr
```

Edits through the links in the agents' skill directories change the files in your checkout. Commit them as usual to keep them in Git.

In an interactive terminal, run `npx skills4me` without a command to pick one from a menu, or `npx skills4me --help` for help.

## Link skills from a checkout

- Put a skill's supporting files next to its `SKILL.md`. A checkout with a single skill can use `skills/SKILL.md` directly, which creates a link named `skills`.
- In an interactive terminal, `link` lists every supported agent. In a noninteractive run, it uses all detected agents.
- To skip the prompt, name agents with `--agent`, as in `npx skills4me link --agent claude-code --agent cursor`. You can name agents that were not detected. `npx skills4me link --help` lists the names.
- Rerun `link` after adding, renaming, or removing skill directories. Links left by renamed or removed skills are removed.
- Existing same-name skills are kept, and conflicts are reported.
- To use several checkouts, run `link` in each. From elsewhere, use `npx skills4me link <directory>`. If you omit the path outside a checkout, an interactive terminal lets you choose one.

## Bring an existing skill into Git

Preview the candidates. Links are skipped. A third-party skill without a recognized record can still appear, so review the list before choosing a skill.

```sh
npx skills4me detect
```

From the destination checkout, run the following in an interactive terminal and choose a skill.

```sh
npx skills4me adopt
```

- `adopt` moves the entire skill into the checkout's `skills/` directory and leaves a link at its original path. Commit the new files as usual.
- Use `--to <directory>` to select the checkout from elsewhere.
- If the destination already uses `skills/SKILL.md` for a standalone skill, put that skill's files in `skills/<name>/` before adopting another skill.
- `detect` and `adopt` also accept `--agent` to search only the named agents' skill directories.

## How it differs from other tools

Keep using your current installer for third-party skills, and use skills4me for the skills you write.

|                                                                         | Local skills                                 | After editing a skill |
| ----------------------------------------------------------------------- | -------------------------------------------- | --------------------- |
| `skills4me link`                                                        | Linked to the originals in your Git checkout | Nothing to do         |
| Vercel's [`skills add`](https://www.skills.sh/docs/cli)                 | Copied                                       | Reinstall             |
| [`openskills install`](https://github.com/numman-ali/openskills#readme) | Copied                                       | Reinstall             |

`adopt` leaves out skills recorded in the `skills` lockfile or by openskills, so it does not take over skills those tools manage.
