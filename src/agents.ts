import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

const { env } = process

/** Identifiers of the supported agents. */
export const agentNames = ["claude", "codex"] as const

/** An identifier for a supported agent. */
export type Agent = (typeof agentNames)[number]

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

type AgentStrategy = {
  configDirectory(): string
  isInstalled(): boolean
  skillPlacement(): AgentSkillPlacement
}

const agentStrategies: Record<Agent, AgentStrategy> = {
  claude: {
    /** Uses a nonblank CLAUDE_CONFIG_DIR or defaults to ~/.claude. */
    configDirectory() {
      return env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude")
    },
    /** Detects Claude Code from its user configuration directory. */
    isInstalled() {
      return existsSync(this.configDirectory())
    },
    /** Returns Claude Code's user skill root and reserved names. */
    skillPlacement() {
      const primaryRoot = resolve(this.configDirectory(), "skills")
      return {
        displayName: "Claude Code",
        primaryRoot: { path: primaryRoot, reservedSkillNames: ["synced"] },
        additionalRoots: [],
      }
    },
  },
  codex: {
    /** Uses a nonblank CODEX_HOME or defaults to ~/.codex. */
    configDirectory() {
      return env.CODEX_HOME?.trim() || join(homedir(), ".codex")
    },
    /** Detects Codex from its user or system configuration directory. */
    isInstalled() {
      return existsSync(this.configDirectory()) || existsSync("/etc/codex")
    },
    /** Returns Codex's shared and compatibility skill roots and reserved names. */
    skillPlacement() {
      const primaryRoot = resolve(homedir(), ".agents", "skills")
      const compatibilityRoot = resolve(this.configDirectory(), "skills")
      return {
        displayName: "Codex",
        primaryRoot: { path: primaryRoot, reservedSkillNames: [] },
        additionalRoots: [
          { path: compatibilityRoot, reservedSkillNames: [".system"] },
        ],
      }
    },
  },
}

/** Detects all supported agents from their configuration paths. */
export function detectInstalledAgents(): Agent[] {
  return agentNames.filter((agent) => agentStrategies[agent].isInstalled())
}

/** Returns the placement rules for the selected agent. */
export function agentSkillPlacement(agent: Agent): AgentSkillPlacement {
  return agentStrategies[agent].skillPlacement()
}
