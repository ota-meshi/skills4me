import { isCancel, select } from "@clack/prompts"
import { define } from "gunshi"
import { adoptSkill } from "../adoption/adopt-skill.ts"
import { agentNames } from "../agents.ts"
import { requireNonEmptyPath } from "../arguments.ts"
import { findCheckout, resolveCheckoutSkillsRoot } from "../checkout.ts"
import { detectSkills } from "../detection.ts"
import { agentOption } from "./support/agent-option.ts"
import { isInteractive } from "./support/terminal.ts"

/** Defines `adopt` with an optional destination checkout and agent selection. */
export const adopt = define({
  name: "adopt",
  description: "Move a selected skill into a local Git checkout",
  args: {
    to: {
      type: "string",
      description:
        "Directory in the destination checkout (defaults to the current directory)",
      parse: requireNonEmptyPath,
    },
    agent: {
      ...agentOption,
      description:
        "Agent whose skill directories to search (repeatable; defaults to all agents)",
    },
  },
  /** Offers detected skills for adoption into the resolved checkout. */
  async run({ log, values }) {
    if (!isInteractive()) {
      throw new Error("The adopt command requires an interactive terminal.")
    }

    const startDirectory = values.to ?? process.cwd()
    const checkout = await findCheckout(startDirectory)
    if (checkout === undefined) {
      throw new Error(`No Git checkout found from ${startDirectory}.`)
    }
    const skillsRoot = await resolveCheckoutSkillsRoot(checkout)

    const { candidates, errors } = await detectSkills(
      values.agent ?? agentNames,
    )
    if (candidates.length === 0) {
      if (errors.length > 0) {
        throw new AggregateError(errors)
      }
      log("No skills to adopt.")
      return
    }
    for (const error of errors) {
      log(error instanceof Error ? error.message : String(error))
    }

    log(`Destination: ${skillsRoot.path}`)
    const source = await select({
      message: "Select a skill to adopt.",
      options: candidates.map((path) => ({ value: path, label: path })),
    })
    if (isCancel(source)) {
      return
    }

    // The destination displayed in the prompt may have changed while it was open.
    if ((await findCheckout(checkout)) !== checkout) {
      throw new Error(`Adoption checkout changed: ${checkout}`)
    }
    const currentSkillsRoot = await resolveCheckoutSkillsRoot(checkout)
    if (currentSkillsRoot.path !== skillsRoot.path) {
      throw new Error(`Adoption destination changed: ${skillsRoot.path}`)
    }
    await adoptSkill(source, currentSkillsRoot, log)
  },
})
