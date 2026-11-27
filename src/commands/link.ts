import { define } from "gunshi"
import { agentSkillPlacement } from "../agents.ts"
import { requireNonEmptyPath } from "../arguments.ts"
import { findSkillDirectories, resolveCheckoutSkillsRoot } from "../checkout.ts"
import { cleanStaleSkillLinks } from "../placement/clean-stale-links.ts"
import { linkSkills } from "../placement/link-skills.ts"
import { agentOption } from "./support/agent-option.ts"
import { resolveLinkAgents } from "./support/link-agents.ts"
import { resolveLinkCheckout } from "./support/link-checkout.ts"

/** Defines `link` with an optional checkout and agent selection. */
export const link = define({
  name: "link",
  description: "Link skills from a local Git checkout",
  args: {
    checkout: {
      type: "positional",
      description:
        "Directory in the checkout (defaults to the current directory)",
      required: false,
      parse: requireNonEmptyPath,
    },
    agent: {
      ...agentOption,
      description:
        "Agent to link skills for, even if it is not detected (repeatable; otherwise uses the detected agents, asking which ones in a terminal)",
    },
  },
  /** Cleans stale checkout links and links skills for the selected or detected agents. */
  async run({ log, values }) {
    const checkout = await resolveLinkCheckout(values.checkout)
    if (checkout === undefined) {
      return
    }
    const agents = await resolveLinkAgents(values.agent)
    if (agents === undefined) {
      return
    }
    if (agents.length === 0) {
      throw new Error("No supported agent detected. Name agents with --agent.")
    }
    const placements = agents.map(agentSkillPlacement)
    const skillsRoot = await resolveCheckoutSkillsRoot(checkout)
    const skillDirectories = skillsRoot.exists
      ? await findSkillDirectories(skillsRoot.path)
      : []

    const agentRoots = placements.flatMap(
      ({ primaryRoot, additionalRoots }) => [primaryRoot, ...additionalRoots],
    )
    const errors = await cleanStaleSkillLinks(skillsRoot.path, agentRoots, log)
    try {
      errors.push(...linkSkills(skillDirectories, placements, log))
    } catch (error) {
      errors.push(error)
    }
    if (errors.length > 0) {
      throw new AggregateError(errors)
    }
  },
})
