# skills4me

## 0.2.1

### Patch Changes

- 3b35d02: Rewrite the README with a diagram of how `link` works, a quick start with example output, and a comparison with other skill installers.

## 0.2.0

### Minor Changes

- 60efbbf: Add `--agent` to `link`, `detect`, and `adopt` to limit them to the named agents, as in `--agent claude-code --agent cursor`.
- 60efbbf: Ask which agents to link for when `link` runs in an interactive terminal without `--agent`, with the detected agents selected.
- 60efbbf: Add support for more coding agents, such as Cursor, Gemini CLI, GitHub Copilot, and OpenCode, in the same user skill directories that the `skills` CLI uses.

## 0.1.0

### Minor Changes

- 4d27570: Add `skills4me` to link skills from local Git checkouts into Claude Code and Codex. Use `detect` to find unmanaged skills and `adopt` to move a selected skill into a checkout while keeping it available at its original path.
