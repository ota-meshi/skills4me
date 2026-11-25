import type { CommandContext } from "gunshi"

/** Rejects an explicit empty path so it cannot be mistaken for an omitted option. */
export function requireNonEmptyPath(value: string): string {
  if (value === "") {
    throw new Error("Expected a non-empty path.")
  }
  return value
}

/** Rejects unconsumed arguments and command names consumed as option values. */
export function validatePositionals({
  args,
  commandPath,
  positionals,
  rest,
  validationError,
}: CommandContext): void {
  if (validationError) {
    return
  }

  // Gunshi can resolve a command name from a token it later consumes as an option value.
  const [command] = commandPath
  if (command !== undefined && positionals[0] !== command) {
    throw new Error(
      `Specify the ${command} command separately from option values.`,
    )
  }

  const declaredPositionalCount = Object.values(args).filter(
    ({ type }) => type === "positional",
  ).length
  // Gunshi includes the command path at the start of the positionals.
  const extraArgument =
    positionals[commandPath.length + declaredPositionalCount] ?? rest[0]
  if (extraArgument !== undefined) {
    throw new Error(`Unexpected argument ${JSON.stringify(extraArgument)}.`)
  }
}
