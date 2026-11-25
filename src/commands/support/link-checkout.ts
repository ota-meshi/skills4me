import { isCancel, path } from "@clack/prompts"
import { findCheckout } from "../../checkout.ts"
import { isInteractive } from "./terminal.ts"

/** Resolves the link checkout, returning undefined when the user cancels. */
export async function resolveLinkCheckout(
  directory: string | undefined,
): Promise<string | undefined> {
  let startDirectory = directory ?? process.cwd()
  let checkout = await findCheckout(startDirectory)

  if (checkout === undefined && directory === undefined && isInteractive()) {
    const selectedDirectory = await path({
      message: "Select a directory in the Git checkout.",
      directory: true,
    })
    if (isCancel(selectedDirectory)) {
      return undefined
    }

    startDirectory = selectedDirectory
    checkout = await findCheckout(startDirectory)
  }

  if (checkout === undefined) {
    throw new Error(`No Git checkout found from ${startDirectory}.`)
  }
  return checkout
}
