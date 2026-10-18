import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { runCli, type CliIo } from "../src/cli-main.js"
import { examplePath } from "./helpers.js"

async function cli(args: string[], stdin = "") {
  let out = ""
  let err = ""
  const io: CliIo = {
    stdout: (t) => (out += t),
    stderr: (t) => (err += t),
    readFile: (p) => readFile(p, "utf8"),
    readStdin: async () => stdin,
  }
  const code = await runCli(args, io)
  return { code, out, err }
}

describe("formular-check CLI", () => {
  it("prints a German text report and fails on findings", async () => {
    const r = await cli([examplePath("kontakt-vorher.html")])
    expect(r.code).toBe(1)
    expect(r.out).toContain("Formular-Check Barrierefreiheit")
    expect(r.out).toContain("Formularfeld ohne Beschriftung")
    expect(r.out).toContain("WCAG 2.2, 4.1.2 Name, Rolle, Wert (Stufe A)")
    expect(r.out).toContain("Lösung:")
    expect(r.out).toContain("Grenzen dieser Prüfung")
  })

  it("passes for the corrected form", async () => {
    const r = await cli([examplePath("kontakt-nachher.html")])
    expect(r.code).toBe(0)
    expect(r.out).toContain("0 Befunde")
  })

  it("prints JSON", async () => {
    const r = await cli(["--json", examplePath("anmeldung-vorher.html")])
    const report = JSON.parse(r.out)
    expect(report.findings.map((f: { id: string }) => f.id)).toContain("paste-blocked")
    expect(report.label).toBe(examplePath("anmeldung-vorher.html"))
  })

  it("prints one summary line per file", async () => {
    const r = await cli(["--summary", examplePath("bestellung-vorher.html"), examplePath("bestellung-nachher.html")])
    const lines = r.out.trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatch(/bestellung-nachher\.html: 1 Formular, \d+ Felder, 0 Befunde$/)
    expect(r.code).toBe(1)
  })

  it("respects --fail-on", async () => {
    const onlyHints = "<!doctype html><html lang=\"de\"><head><title>T</title></head><body><h1>T</h1><form><label for=a>A</label><input id=a name=a><label for=b>B</label><input id=b name=b><button>OK</button></form></body></html>"
    expect((await cli(["-"], onlyHints)).code).toBe(0)
    expect((await cli(["--fail-on", "hint", "-"], onlyHints)).code).toBe(1)
    expect((await cli(["--fail-on=never", examplePath("kontakt-vorher.html")])).code).toBe(0)
    expect((await cli(["--fail-on", "kritisch", examplePath("anmeldung-vorher.html")])).code).toBe(1)
  })

  it("reads standard input", async () => {
    const r = await cli(["--json", "--fragment", "-"], '<form><input name="x"></form>')
    const report = JSON.parse(r.out)
    expect(report.fragment).toBe(true)
    expect(report.label).toBe("Standardeingabe")
  })

  it("handles usage errors", async () => {
    expect((await cli([])).code).toBe(2)
    expect((await cli(["--unknown"])).code).toBe(2)
    expect((await cli(["--fail-on", "sometimes", "x.html"])).code).toBe(2)
    const missing = await cli(["does-not-exist.html"])
    expect(missing.code).toBe(2)
    expect(missing.err).toContain("cannot read")
  })

  it("shows help and version", async () => {
    const help = await cli(["--help"])
    expect(help.code).toBe(0)
    expect(help.out).toContain("Usage:")
    expect((await cli(["--version"])).out).toMatch(/^\d+\.\d+\.\d+\n$/)
  })
})
