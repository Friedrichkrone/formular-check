#!/usr/bin/env node
// Startpunkt der Kommandozeile (siehe cli-main.ts)

import { readFile } from "node:fs/promises"
import { runCli } from "./cli-main.js"

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  return Buffer.concat(chunks).toString("utf8")
}

process.exitCode = await runCli(process.argv.slice(2), {
  stdout: (t) => process.stdout.write(t),
  stderr: (t) => process.stderr.write(t),
  readFile: (p) => readFile(p, "utf8"),
  readStdin,
})
