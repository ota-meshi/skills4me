import { define } from "gunshi"
import { agentNames } from "../agents.ts"
import { detectSkills } from "../detection.ts"
import { agentOption } from "./support/agent-option.ts"

/** Defines `detect` with an optional agent selection. */
export const detect = define({
  name: "detect",
  description: "List skill directories eligible for adoption",
  args: {
    agent: {
      ...agentOption,
      description:
        "Agent whose skill directories to search (repeatable; defaults to all agents)",
    },
  },
  /** Lists adoption candidates and reports incomplete scans. */
  async run({ log, values }) {
    const { candidates, errors } = await detectSkills(
      values.agent ?? agentNames,
    )
    for (const path of candidates) {
      log(path)
    }
    if (errors.length > 0) {
      throw new AggregateError(errors)
    }
  },
})
