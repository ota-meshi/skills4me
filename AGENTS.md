# AGENTS.md

[日本語](AGENTS.ja.md)

## Design

- Before choosing a design, use concrete examples from the confirmed requirements to identify what each operation must decide and what existing information it can use.
- Choose the simplest design that meets the requirements. Add validation or persistent state only when you can explain which required behavior needs it and why a simpler design cannot provide that behavior.
- Before presenting the design, check each mechanism against the requirements and remove anything that serves only an unconfirmed assumption.

## Implementation

- Before implementing behavior that depends on a library, check the official documentation for the version in use. Use its public API for operations it supports. Preserve the caller's inputs and explicit settings through to the operations that use them.
- Prioritize readable code. Compare direct calls, data, functions, and objects against the actual calls and data flow. Use established design patterns when they clarify responsibilities or reduce repetition, keeping their use simple and limited to the problem at hand.
- Name files, types, and functions for what they actually do. Make it clear at the call site whether an operation creates a value, makes a decision, or changes state. Use each tool's actual name for tool-specific code.
- Keep the main steps of an operation visible in its main function or module. Put command definitions directly in `src/commands/` and helpers in `src/commands/support/`. Group code for external installer records by tool in `src/installers/`.
- Keep naming, interfaces, and implementation patterns consistent across related code. Design interfaces around the receiving code's responsibility and pass the values it needs. Resolve choices in the code that owns them and pass the resolved values to the operations that use them.
- Treat function arguments as read-only by default and return computed results.
- Write JSDoc for functions and exported declarations. Use inline comments to explain non-obvious choices about order, scope, or failure handling.
- Before finishing, trace the change from its normal entry point. Check that the role of each operation and the flow of inputs and results are clear at the call sites.

## Documentation

- Split long material by purpose. Use short sections and lists to make key points easy to find, and link to related documents.
- Maintain an English `.md` version and a Japanese `.ja.md` version of each project document, including this file.
- Apply content additions and updates to both versions. Keep each pair in the same directory and link the versions to each other.
