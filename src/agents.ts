import { agentStrategies } from "./agent-strategies.ts"

/** A user-level skill directory and the names reserved within it. */
export type AgentSkillRoot = {
  path: string
  reservedSkillNames: readonly string[]
}

/** The main user-level placement and any other roots an agent reads. */
export type AgentSkillPlacement = {
  displayName: string
  primaryRoot: AgentSkillRoot
  additionalRoots: readonly AgentSkillRoot[]
}

/** An identifier for a supported agent. */
export type Agent = keyof typeof agentStrategies

/** Identifiers of the supported agents. */
export const agentNames = Object.keys(agentStrategies) as Agent[]

/** Detects all supported agents from their configuration paths. */
export function detectInstalledAgents(): Agent[] {
  return agentNames.filter((agent) => agentStrategies[agent].isInstalled())
}

/** Returns the placement rules for the selected agent. */
export function agentSkillPlacement(agent: Agent): AgentSkillPlacement {
  return agentStrategies[agent].skillPlacement()
}

/** Lists the project skill directories where the skills CLI installs for the supported agents. */
export function skillsCliProjectSkillDirectories(): string[] {
  return [
    ...new Set(
      agentNames.map(
        (agent) => agentStrategies[agent].skillsCliProjectSkillDirectory,
      ),
    ),
  ]
}
