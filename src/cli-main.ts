// Kommandozeile: formular-check <datei.html> [weitere Dateien] [Optionen]
// Die Logik steht hier, damit Tests sie ohne eigenen Prozess aufrufen können.

import { analyzeHtml } from "./node.js"
import type { Report } from "./analyze.js"
import { SEVERITIES, type Severity } from "./rules.js"
import { summaryLine, textReport } from "./report.js"
import { VERSION } from "./version.js"

export interface CliIo {
  stdout: (text: string) => void
  stderr: (text: string) => void
  readFile: (path: string) => Promise<string>
  readStdin: () => Promise<string>
}

const HELP = `formular-check ${VERSION}
Static accessibility check for HTML forms (WCAG 2.2). Reports are in German.

Usage:
  formular-check [options] <file.html> [more files]
  formular-check [options] -          read HTML from standard input

Options:
  --json             print the reports as JSON
  --summary          print one summary line per file instead of the full report
  --fail-on <level>  exit with code 1 if a finding of this severity or higher exists
                     kritisch | hoch | mittel | hinweis | never   (default: mittel)
                     English names work too: critical | high | medium | hint
  --fragment         treat the input as a fragment (no <html> element)
  -h, --help         show this help
  -v, --version      show the version

Exit codes: 0 no findings at or above --fail-on, 1 findings, 2 usage or read error.
No scripts are executed and nothing is loaded from the network.
`

const ALIASES: Record<string, Severity | "never"> = {
  kritisch: "kritisch",
  critical: "kritisch",
  hoch: "hoch",
  high: "hoch",
  mittel: "mittel",
  medium: "mittel",
  hinweis: "hinweis",
  hint: "hinweis",
  never: "never",
  nie: "never",
}

/** true, wenn ein Befund mindestens die Schwere threshold hat */
export function failsAt(report: Report, threshold: Severity | "never"): boolean {
  if (threshold === "never") return false
  const limit = SEVERITIES.indexOf(threshold)
  return report.findings.some((f) => SEVERITIES.indexOf(f.sev) <= limit)
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const files: string[] = []
  let json = false
  let summary = false
  let fragment: boolean | undefined
  let failOn: Severity | "never" = "mittel"

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "-h" || a === "--help") {
      io.stdout(HELP)
      return 0
    }
    if (a === "-v" || a === "--version") {
      io.stdout(`${VERSION}\n`)
      return 0
    }
    if (a === "--json") json = true
    else if (a === "--summary") summary = true
    else if (a === "--fragment") fragment = true
    else if (a === "--fail-on" || a.startsWith("--fail-on=")) {
      const v = (a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[++i] ?? "").toLowerCase()
      const level = ALIASES[v]
      if (!level) {
        io.stderr(`formular-check: unknown level for --fail-on: "${v}"\n`)
        return 2
      }
      failOn = level
    } else if (a.startsWith("-") && a !== "-") {
      io.stderr(`formular-check: unknown option ${a}\nTry formular-check --help\n`)
      return 2
    } else files.push(a)
  }

  if (!files.length) {
    io.stderr(`formular-check: no input file\n\n${HELP}`)
    return 2
  }

  const reports: Report[] = []
  for (const file of files) {
    let html: string
    try {
      html = file === "-" ? await io.readStdin() : await io.readFile(file)
    } catch (e) {
      io.stderr(`formular-check: cannot read ${file}: ${(e as Error).message}\n`)
      return 2
    }
    reports.push(analyzeHtml(html, { label: file === "-" ? "Standardeingabe" : file, fragment }))
  }

  if (json) io.stdout(`${JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2)}\n`)
  else if (summary) for (const r of reports) io.stdout(`${r.label}: ${summaryLine(r)}\n`)
  else io.stdout(reports.map((r) => textReport(r)).join("\n\n" + "=".repeat(72) + "\n\n") + "\n")

  return reports.some((r) => failsAt(r, failOn)) ? 1 : 0
}
