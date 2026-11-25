import myPlugin from "@ota-meshi/eslint-plugin"

/** Configures ESLint for the Node.js CLI and its TypeScript tests. */
export default [
  { ignores: ["dist/"] },
  ...myPlugin.config({
    node: true,
    ts: true,
    prettier: true,
  }),
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    settings: {
      n: {
        typescriptExtensionMap: [],
      },
    },
    rules: {
      "n/file-extension-in-import": ["error", "always"],
      "jsdoc/require-jsdoc": [
        "error",
        {
          enableFixer: false,
          contexts: [
            "ExportNamedDeclaration:not([declaration.type='FunctionDeclaration'])",
            "ExportDefaultDeclaration:not([declaration.type='FunctionDeclaration'])",
            "ExportAllDeclaration",
          ],
          require: {
            FunctionDeclaration: true,
            FunctionExpression: true,
            ArrowFunctionExpression: true,
            MethodDefinition: true,
          },
        },
      ],
      "jsdoc/no-blank-blocks": "error",
      "jsdoc/no-blank-block-descriptions": "error",
    },
  },
  {
    files: ["src/skills4me.ts"],
    rules: {
      "no-console": ["warn", { allow: ["error"] }],
      "n/hashbang": [
        "error",
        {
          convertPath: {
            "src/skills4me.ts": ["^src/skills4me[.]ts$", "dist/skills4me.mjs"],
          },
        },
      ],
    },
  },
]
