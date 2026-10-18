import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))

export const examplePath = (name: string) => join(here, "..", "examples", name)

/** Beispiel aus examples/ lesen */
export function example(name: string): string {
  return readFileSync(examplePath(name), "utf8")
}
