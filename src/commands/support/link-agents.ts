import { autocompleteMultiselect, isCancel } from "@clack/prompts"
import {
  type Agent,
  agentSkillPlacement,
  detectInstalledAgents,
} from "../../agents.ts"
import { isInteractive } from "./terminal.ts"

/**
 * Resolves the agents to link for, returning undefined when the user cancels.
 * Without named agents, an interactive terminal offers the detected agents, all selected.
 */
export async function resolveLinkAgents(
  namedAgents: Agent[] | undefined,
): Promise<Agent[] | undefined> {
  if (namedAgents !== undefined) {
    return namedAgents
  }
  const detectedAgents = detectInstalledAgents()
  // Without detected agents there is nothing to offer, so let the caller report it.
  if (detectedAgents.length === 0 || !isInteractive()) {
    return detectedAgents
  }

  // Clack splits a union of agent names into one option type per name, so pass plain strings.
  const selectedNames = await autocompleteMultiselect<string>({
    message: "Select target agents.",
    options: detectedAgents.map((agent) => ({
      value: agent,
      label: agentSkillPlacement(agent).displayName,
      hint: agent,
    })),
    initialValues: detectedAgents,
    required: true,
  })
  if (isCancel(selectedNames)) {
    return undefined
  }
  return detectedAgents.filter((agent) => selectedNames.includes(agent))
}
