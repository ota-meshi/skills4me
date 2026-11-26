import { autocompleteMultiselect, isCancel } from "@clack/prompts"
import {
  type Agent,
  agentNames,
  agentSkillPlacement,
  detectInstalledAgents,
} from "../../agents.ts"
import { isInteractive } from "./terminal.ts"

/**
 * Resolves the agents to link for, returning undefined when the user cancels.
 * Without named agents, an interactive terminal offers every agent with the detected ones selected.
 */
export async function resolveLinkAgents(
  namedAgents: Agent[] | undefined,
): Promise<Agent[] | undefined> {
  if (namedAgents !== undefined) {
    return namedAgents
  }
  const detectedAgents = detectInstalledAgents()
  if (!isInteractive()) {
    return detectedAgents
  }

  // Clack splits a union of agent names into one option type per name, so pass plain strings.
  const selectedNames = await autocompleteMultiselect<string>({
    message: "Select target agents.",
    options: agentNames.map((agent) => ({
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
  return agentNames.filter((agent) => selectedNames.includes(agent))
}
