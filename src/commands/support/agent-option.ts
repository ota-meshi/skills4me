import { agentNames } from "../../agents.ts"

/** The repeatable `--agent` option, which takes agent names used by the skills CLI. */
export const agentOption = {
  type: "enum",
  short: "a",
  choices: agentNames,
  multiple: true,
} as const
