#!/usr/bin/env node

import { isCancel, select } from "@clack/prompts"
import { cli, define, type SubCommandable } from "gunshi"
import packageInfo from "../package.json" with { type: "json" }
import { validatePositionals } from "./arguments.ts"
import { adopt } from "./commands/adopt.ts"
import { detect } from "./commands/detect.ts"
import { link } from "./commands/link.ts"
import { isInteractive } from "./commands/support/terminal.ts"

const { description, name, version } = packageInfo
const subCommands = { link, detect, adopt }
const cliOptions = {
  name,
  version,
  strict: true,
  onBeforeCommand: validatePositionals,
  renderHeader: null,
  renderValidationErrors: null,
}

const entry = define({
  name,
  description,
  /** Prompts for a command when Gunshi runs the entry without a subcommand. */
  async run({ _: originalArgs, omitted: subcommandOmitted }) {
    if (!subcommandOmitted || !isInteractive()) {
      return
    }

    const command = await select<SubCommandable>({
      message: "Select a command.",
      options: Object.entries(subCommands).map(([label, value]) => ({
        value,
        label,
        hint: value.description,
      })),
    })
    if (!isCancel(command)) {
      // Use Gunshi's original arguments and the same validation for the selection.
      await cli(originalArgs, command, cliOptions)
    }
  },
})

try {
  await cli(process.argv.slice(2), entry, { ...cliOptions, subCommands })
} catch (error) {
  const errors: unknown[] =
    error instanceof AggregateError ? error.errors : [error]
  for (const cause of errors) {
    console.error(
      `${name}: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  }
  process.exitCode = 1
}
