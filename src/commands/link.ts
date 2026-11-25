import { define } from "gunshi"
import { agentSkillPlacement, detectInstalledAgents } from "../agents.ts"
import { requireNonEmptyPath } from "../arguments.ts"
import { findSkillDirectories, resolveCheckoutSkillsRoot } from "../checkout.ts"
import { cleanStaleSkillLinks } from "../placement/clean-stale-links.ts"
import { linkSkills } from "../placement/link-skills.ts"
import { resolveLinkCheckout } from "./support/link-checkout.ts"

/** Defines `link` with an optional checkout. */
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
  },
  /** Cleans stale checkout links and links skills for every detected agent. */
  async run({ log, values }) {
    const checkout = await resolveLinkCheckout(values.checkout)
    if (checkout === undefined) {
      return
    }
    const agents = detectInstalledAgents()
    if (agents.length === 0) {
      throw new Error("No supported agent detected.")
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
