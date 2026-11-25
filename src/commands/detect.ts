import { define } from "gunshi"
import { detectSkills } from "../detection.ts"

/** Registers `detect` without a checkout path or agent option. */
export const detect = define({
  name: "detect",
  description: "List skill directories eligible for adoption",
  /** Lists adoption candidates and reports incomplete scans. */
  async run({ log }) {
    const { candidates, errors } = await detectSkills()
    for (const path of candidates) {
      log(path)
    }
    if (errors.length > 0) {
      throw new AggregateError(errors)
    }
  },
})
