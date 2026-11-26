import { existsSync } from "node:fs"
import { homedir, platform } from "node:os"
import { join, resolve } from "node:path"
import type { AgentSkillPlacement } from "./agents.ts"

const { env } = process

type AgentStrategy = {
  /** The skill directory in a project where the skills CLI installs for the agent. */
  skillsCliProjectSkillDirectory: string
  configDirectory(): string
  isInstalled(): boolean
  skillPlacement(): AgentSkillPlacement
}

/** Returns a path in the user's home directory. */
function homePath(...segments: string[]): string {
  return join(homedir(), ...segments)
}

/** Returns a path in a nonblank XDG_CONFIG_HOME or ~/.config. */
function xdgConfigPath(...segments: string[]): string {
  return join(env.XDG_CONFIG_HOME?.trim() || homePath(".config"), ...segments)
}

/** Uses a nonblank environment variable or defaults to a directory in home. */
function envOrHomePath(name: string, directory: string): string {
  return env[name]?.trim() || homePath(directory)
}

/** Returns the user skill root that Codex shares with several other agents. */
function sharedSkillRoot(): string {
  return homePath(".agents", "skills")
}

/**
 * Creates the strategy for an agent that reads one user skill root.
 * The caller builds the paths when this module loads,
 * which is enough because each CLI run is a new process.
 */
function createSingleRootStrategy({
  displayName,
  skillsCliProjectSkillDirectory,
  configDirectory,
  additionalInstallPaths = [],
  skillRoot = join(configDirectory, "skills"),
}: {
  displayName: string
  /** The skill directory in a project where the skills CLI installs for the agent. */
  skillsCliProjectSkillDirectory: string
  /** The directory whose existence shows the agent is installed. */
  configDirectory: string
  /** Other paths whose existence also shows the agent is installed. */
  additionalInstallPaths?: readonly string[]
  /** The user skill root. Defaults to `skills` in the configuration directory. */
  skillRoot?: string
}): AgentStrategy {
  return {
    skillsCliProjectSkillDirectory,
    /** Returns the configuration directory given to the factory. */
    configDirectory() {
      return configDirectory
    },
    /** Detects the agent from its configuration directory or other installation paths. */
    isInstalled() {
      return [configDirectory, ...additionalInstallPaths].some((path) =>
        existsSync(path),
      )
    },
    /** Returns the agent's user skill root without reserved names. */
    skillPlacement() {
      return {
        displayName,
        primaryRoot: { path: resolve(skillRoot), reservedSkillNames: [] },
        additionalRoots: [],
      }
    },
  }
}

/**
 * The strategies of the supported agents.
 * Paths follow the skill directories in skills CLI v1.9.0,
 * including the ones it places in ~/.config regardless of XDG_CONFIG_HOME.
 */
export const agentStrategies = {
  claude: {
    skillsCliProjectSkillDirectory: ".claude/skills",
    /** Uses a nonblank CLAUDE_CONFIG_DIR or defaults to ~/.claude. */
    configDirectory() {
      return envOrHomePath("CLAUDE_CONFIG_DIR", ".claude")
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
    skillsCliProjectSkillDirectory: ".agents/skills",
    /** Uses a nonblank CODEX_HOME or defaults to ~/.codex. */
    configDirectory() {
      return envOrHomePath("CODEX_HOME", ".codex")
    },
    /** Detects Codex from its user or system configuration directory. */
    isInstalled() {
      return existsSync(this.configDirectory()) || existsSync("/etc/codex")
    },
    /** Returns Codex's shared and compatibility skill roots and reserved names. */
    skillPlacement() {
      const primaryRoot = resolve(sharedSkillRoot())
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
  adal: createSingleRootStrategy({
    displayName: "AdaL",
    skillsCliProjectSkillDirectory: ".adal/skills",
    configDirectory: homePath(".adal"),
  }),
  "aider-desk": createSingleRootStrategy({
    displayName: "AiderDesk",
    skillsCliProjectSkillDirectory: ".aider-desk/skills",
    configDirectory: homePath(".aider-desk"),
  }),
  amp: createSingleRootStrategy({
    displayName: "Amp",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: xdgConfigPath("amp"),
    skillRoot: xdgConfigPath("agents", "skills"),
  }),
  antigravity: createSingleRootStrategy({
    displayName: "Antigravity",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".gemini", "antigravity"),
    skillRoot: homePath(".gemini", "config", "skills"),
  }),
  "antigravity-cli": createSingleRootStrategy({
    displayName: "Antigravity CLI",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".gemini", "antigravity-cli"),
    skillRoot: homePath(".gemini", "config", "skills"),
  }),
  astrbot: createSingleRootStrategy({
    displayName: "AstrBot",
    skillsCliProjectSkillDirectory: "data/skills",
    configDirectory: homePath(".astrbot"),
    skillRoot: homePath(".astrbot", "data", "skills"),
  }),
  augment: createSingleRootStrategy({
    displayName: "Augment",
    skillsCliProjectSkillDirectory: ".augment/skills",
    configDirectory: homePath(".augment"),
  }),
  "autohand-code": createSingleRootStrategy({
    displayName: "Autohand Code CLI",
    skillsCliProjectSkillDirectory: ".autohand/skills",
    configDirectory: envOrHomePath("AUTOHAND_HOME", ".autohand"),
  }),
  bob: createSingleRootStrategy({
    displayName: "IBM Bob",
    skillsCliProjectSkillDirectory: ".bob/skills",
    configDirectory: homePath(".bob"),
  }),
  cline: createSingleRootStrategy({
    displayName: "Cline",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".cline"),
    skillRoot: sharedSkillRoot(),
  }),
  "codearts-agent": createSingleRootStrategy({
    displayName: "CodeArts Agent",
    skillsCliProjectSkillDirectory: ".codeartsdoer/skills",
    configDirectory: homePath(".codeartsdoer"),
  }),
  codebuddy: createSingleRootStrategy({
    displayName: "CodeBuddy",
    skillsCliProjectSkillDirectory: ".codebuddy/skills",
    configDirectory: homePath(".codebuddy"),
  }),
  codemaker: createSingleRootStrategy({
    displayName: "Codemaker",
    skillsCliProjectSkillDirectory: ".codemaker/skills",
    configDirectory: homePath(".codemaker"),
  }),
  codestudio: createSingleRootStrategy({
    displayName: "Code Studio",
    skillsCliProjectSkillDirectory: ".codestudio/skills",
    configDirectory: homePath(".codestudio"),
  }),
  "command-code": createSingleRootStrategy({
    displayName: "Command Code",
    skillsCliProjectSkillDirectory: ".commandcode/skills",
    configDirectory: homePath(".commandcode"),
  }),
  continue: createSingleRootStrategy({
    displayName: "Continue",
    skillsCliProjectSkillDirectory: ".continue/skills",
    configDirectory: homePath(".continue"),
  }),
  cortex: createSingleRootStrategy({
    displayName: "Cortex Code",
    skillsCliProjectSkillDirectory: ".cortex/skills",
    configDirectory: homePath(".snowflake", "cortex"),
  }),
  crush: createSingleRootStrategy({
    displayName: "Crush",
    skillsCliProjectSkillDirectory: ".crush/skills",
    configDirectory: homePath(".config", "crush"),
  }),
  cursor: createSingleRootStrategy({
    displayName: "Cursor",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".cursor"),
  }),
  deepagents: createSingleRootStrategy({
    displayName: "Deep Agents",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".deepagents"),
    skillRoot: homePath(".deepagents", "agent", "skills"),
  }),
  devin: createSingleRootStrategy({
    displayName: "Devin for Terminal",
    skillsCliProjectSkillDirectory: ".devin/skills",
    configDirectory: xdgConfigPath("devin"),
  }),
  dexto: createSingleRootStrategy({
    displayName: "Dexto",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".dexto"),
    skillRoot: sharedSkillRoot(),
  }),
  droid: createSingleRootStrategy({
    displayName: "Droid",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".factory"),
  }),
  firebender: createSingleRootStrategy({
    displayName: "Firebender",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".firebender"),
  }),
  forgecode: createSingleRootStrategy({
    displayName: "ForgeCode",
    skillsCliProjectSkillDirectory: ".forge/skills",
    configDirectory: homePath(".forge"),
  }),
  fx: createSingleRootStrategy({
    displayName: "fx",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".fx"),
    skillRoot: sharedSkillRoot(),
  }),
  "gemini-cli": createSingleRootStrategy({
    displayName: "Gemini CLI",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".gemini"),
  }),
  "github-copilot": createSingleRootStrategy({
    displayName: "GitHub Copilot",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".copilot"),
  }),
  goose: createSingleRootStrategy({
    displayName: "Goose",
    skillsCliProjectSkillDirectory: ".goose/skills",
    configDirectory: xdgConfigPath("goose"),
  }),
  grok: createSingleRootStrategy({
    displayName: "Grok Build",
    skillsCliProjectSkillDirectory: ".grok/skills",
    configDirectory: envOrHomePath("GROK_HOME", ".grok"),
  }),
  "hermes-agent": createSingleRootStrategy({
    displayName: "Hermes Agent",
    skillsCliProjectSkillDirectory: ".hermes/skills",
    configDirectory: envOrHomePath("HERMES_HOME", ".hermes"),
  }),
  "iflow-cli": createSingleRootStrategy({
    displayName: "iFlow CLI",
    skillsCliProjectSkillDirectory: ".iflow/skills",
    configDirectory: homePath(".iflow"),
  }),
  "inference-sh": createSingleRootStrategy({
    displayName: "inference.sh",
    skillsCliProjectSkillDirectory: ".inferencesh/skills",
    configDirectory: homePath(".inferencesh"),
  }),
  jazz: createSingleRootStrategy({
    displayName: "Jazz",
    skillsCliProjectSkillDirectory: ".jazz/skills",
    configDirectory: homePath(".jazz"),
  }),
  junie: createSingleRootStrategy({
    displayName: "Junie",
    skillsCliProjectSkillDirectory: ".junie/skills",
    configDirectory: homePath(".junie"),
  }),
  kilo: createSingleRootStrategy({
    displayName: "Kilo Code",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".kilo"),
    additionalInstallPaths: [homePath(".kilocode")],
  }),
  kimchi: createSingleRootStrategy({
    displayName: "Kimchi",
    skillsCliProjectSkillDirectory: ".kimchi/skills",
    configDirectory: homePath(".config", "kimchi"),
    skillRoot: homePath(".config", "kimchi", "harness", "skills"),
  }),
  "kimi-code-cli": createSingleRootStrategy({
    displayName: "Kimi Code CLI",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".kimi-code"),
    additionalInstallPaths: [homePath(".kimi")],
    skillRoot: sharedSkillRoot(),
  }),
  "kiro-cli": createSingleRootStrategy({
    displayName: "Kiro CLI",
    skillsCliProjectSkillDirectory: ".kiro/skills",
    configDirectory: homePath(".kiro"),
  }),
  kode: createSingleRootStrategy({
    displayName: "Kode",
    skillsCliProjectSkillDirectory: ".kode/skills",
    configDirectory: homePath(".kode"),
  }),
  lingma: createSingleRootStrategy({
    displayName: "Lingma",
    skillsCliProjectSkillDirectory: ".lingma/skills",
    configDirectory: homePath(".lingma"),
  }),
  loaf: createSingleRootStrategy({
    displayName: "Loaf",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".loaf"),
    skillRoot: sharedSkillRoot(),
  }),
  mcpjam: createSingleRootStrategy({
    displayName: "MCPJam",
    skillsCliProjectSkillDirectory: ".mcpjam/skills",
    configDirectory: homePath(".mcpjam"),
  }),
  "minimax-code": createSingleRootStrategy({
    displayName: "MiniMax Code",
    skillsCliProjectSkillDirectory: ".minimax/skills",
    configDirectory: homePath(".minimax"),
    additionalInstallPaths: ["/Applications/MiniMax Code.app"],
  }),
  "mistral-vibe": createSingleRootStrategy({
    displayName: "Mistral Vibe",
    skillsCliProjectSkillDirectory: ".vibe/skills",
    configDirectory: envOrHomePath("VIBE_HOME", ".vibe"),
  }),
  moxby: createSingleRootStrategy({
    displayName: "Moxby",
    skillsCliProjectSkillDirectory: ".moxby/skills",
    configDirectory: homePath(".moxby"),
  }),
  mux: createSingleRootStrategy({
    displayName: "Mux",
    skillsCliProjectSkillDirectory: ".mux/skills",
    configDirectory: homePath(".mux"),
  }),
  neovate: createSingleRootStrategy({
    displayName: "Neovate",
    skillsCliProjectSkillDirectory: ".neovate/skills",
    configDirectory: homePath(".neovate"),
  }),
  ona: createSingleRootStrategy({
    displayName: "Ona",
    skillsCliProjectSkillDirectory: ".ona/skills",
    configDirectory: homePath(".ona"),
  }),
  openclaw: createSingleRootStrategy({
    displayName: "OpenClaw",
    skillsCliProjectSkillDirectory: "skills",
    configDirectory:
      [".openclaw", ".clawdbot", ".moltbot"]
        .map((name) => homePath(name))
        .find((path) => existsSync(path)) ?? homePath(".openclaw"),
  }),
  opencode: createSingleRootStrategy({
    displayName: "OpenCode",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: xdgConfigPath("opencode"),
  }),
  openhands: createSingleRootStrategy({
    displayName: "OpenHands",
    skillsCliProjectSkillDirectory: ".openhands/skills",
    configDirectory: homePath(".openhands"),
  }),
  pi: createSingleRootStrategy({
    displayName: "Pi",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".pi", "agent"),
    skillRoot: sharedSkillRoot(),
  }),
  pochi: createSingleRootStrategy({
    displayName: "Pochi",
    skillsCliProjectSkillDirectory: ".pochi/skills",
    configDirectory: homePath(".pochi"),
  }),
  "posit-assistant": createSingleRootStrategy({
    displayName: "Posit Assistant",
    skillsCliProjectSkillDirectory: ".posit/assistant/skills",
    configDirectory: homePath(".posit", "assistant"),
    additionalInstallPaths: [homePath(".positai")],
  }),
  qoder: createSingleRootStrategy({
    displayName: "Qoder",
    skillsCliProjectSkillDirectory: ".qoder/skills",
    configDirectory: homePath(".qoder"),
  }),
  "qoder-cn": createSingleRootStrategy({
    displayName: "Qoder CN",
    skillsCliProjectSkillDirectory: ".qoder/skills",
    configDirectory: homePath(".qoder-cn"),
  }),
  "qwen-code": createSingleRootStrategy({
    displayName: "Qwen Code",
    skillsCliProjectSkillDirectory: ".qwen/skills",
    configDirectory: homePath(".qwen"),
  }),
  reasonix: createSingleRootStrategy({
    displayName: "Reasonix",
    skillsCliProjectSkillDirectory: ".reasonix/skills",
    configDirectory:
      env.REASONIX_HOME?.trim() ||
      (platform() === "win32"
        ? join(
            env.APPDATA?.trim() || homePath("AppData", "Roaming"),
            "reasonix",
          )
        : homePath(".reasonix")),
  }),
  roo: createSingleRootStrategy({
    displayName: "Roo Code",
    skillsCliProjectSkillDirectory: ".roo/skills",
    configDirectory: homePath(".roo"),
  }),
  rovodev: createSingleRootStrategy({
    displayName: "Rovo Dev",
    skillsCliProjectSkillDirectory: ".rovodev/skills",
    configDirectory: homePath(".rovodev"),
  }),
  "sarvam-code": createSingleRootStrategy({
    displayName: "Sarvam Code",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: envOrHomePath("SARVAM_HOME", ".sarvam"),
    skillRoot: sharedSkillRoot(),
  }),
  "tabnine-cli": createSingleRootStrategy({
    displayName: "Tabnine CLI",
    skillsCliProjectSkillDirectory: ".tabnine/agent/skills",
    configDirectory: homePath(".tabnine"),
    skillRoot: homePath(".tabnine", "agent", "skills"),
  }),
  terramind: createSingleRootStrategy({
    displayName: "Terramind",
    skillsCliProjectSkillDirectory: ".terramind/skills",
    configDirectory: homePath(".terramind"),
  }),
  tinycloud: createSingleRootStrategy({
    displayName: "Tinycloud",
    skillsCliProjectSkillDirectory: ".tinycloud/skills",
    configDirectory: homePath(".tinycloud"),
  }),
  trae: createSingleRootStrategy({
    displayName: "Trae",
    skillsCliProjectSkillDirectory: ".trae/skills",
    configDirectory: homePath(".trae"),
  }),
  "trae-cn": createSingleRootStrategy({
    displayName: "Trae CN",
    skillsCliProjectSkillDirectory: ".trae/skills",
    configDirectory: homePath(".trae-cn"),
  }),
  warp: createSingleRootStrategy({
    displayName: "Warp",
    skillsCliProjectSkillDirectory: ".agents/skills",
    configDirectory: homePath(".warp"),
    skillRoot: sharedSkillRoot(),
  }),
  windsurf: createSingleRootStrategy({
    displayName: "Windsurf",
    skillsCliProjectSkillDirectory: ".windsurf/skills",
    configDirectory: homePath(".codeium", "windsurf"),
  }),
  zcode: createSingleRootStrategy({
    displayName: "ZCode",
    skillsCliProjectSkillDirectory: ".zcode/skills",
    configDirectory: homePath(".zcode"),
    additionalInstallPaths: ["/Applications/ZCode.app"],
  }),
  zed: {
    skillsCliProjectSkillDirectory: ".agents/skills",
    /** Uses zed in a nonblank XDG_CONFIG_HOME or ~/.config. */
    configDirectory() {
      return xdgConfigPath("zed")
    },
    /** Detects Zed from its XDG, Windows, or Flatpak configuration directory. */
    isInstalled() {
      const directories = [this.configDirectory()]
      const appData = env.APPDATA?.trim()
      if (appData) {
        directories.push(join(appData, "Zed"))
      }
      const flatpakConfigHome = env.FLATPAK_XDG_CONFIG_HOME?.trim()
      if (flatpakConfigHome) {
        directories.push(join(flatpakConfigHome, "zed"))
      }
      return directories.some((path) => existsSync(path))
    },
    /** Returns the shared user skill root that Zed reads. */
    skillPlacement() {
      return {
        displayName: "Zed",
        primaryRoot: {
          path: resolve(sharedSkillRoot()),
          reservedSkillNames: [],
        },
        additionalRoots: [],
      }
    },
  },
  zencoder: createSingleRootStrategy({
    displayName: "Zencoder",
    skillsCliProjectSkillDirectory: ".zencoder/skills",
    configDirectory: homePath(".zencoder"),
  }),
  zenflow: createSingleRootStrategy({
    displayName: "Zenflow",
    skillsCliProjectSkillDirectory: ".zencoder/skills",
    configDirectory: homePath(".zencoder"),
  }),
} satisfies Record<string, AgentStrategy>
