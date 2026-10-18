import { describe, expect, it } from "vitest"
import { analyze, analyzeHtml, CRITERIA, EXAMPLE_HTML, parseHtml, RULES, SEVERITIES, type Report } from "../src/node.js"
import { example } from "./helpers.js"

const ids = (r: Report) => r.findings.map((f) => f.id).sort()

// Jedes Paar: dasselbe Formular mit typischen Fehlern (vorher) und korrigiert (nachher)
const PAIRS: { name: string; expected: string[] }[] = [
  {
    name: "kontakt",
    expected: [
      "autocomplete",
      "button-no-name",
      "captcha-quiz",
      "field-no-name",
      "group-no-fieldset",
      "heading-skip",
      "lang-missing",
      "no-live-region",
      "outline-inline",
      "placeholder-only",
      "required-asterisk",
      "viewport-zoom",
    ],
  },
  {
    name: "anmeldung",
    expected: ["autocomplete", "captcha-auth", "fake-button", "fake-submit", "no-live-region", "paste-blocked"],
  },
  {
    name: "bestellung",
    expected: [
      "autocomplete",
      "button-no-name",
      "field-no-name",
      "iframe-no-title",
      "img-no-alt",
      "invalid-no-message",
      "label-for-missing",
      "lang-invalid",
      "link-no-name",
      "meta-refresh",
      "no-live-region",
      "onchange-context",
      "outline-css",
      "tabindex-positive",
    ],
  },
]

describe.each(PAIRS)("$name", ({ name, expected }) => {
  it("before: finds the typical barriers", () => {
    const r = analyzeHtml(example(`${name}-vorher.html`), { label: `${name}-vorher.html` })
    expect(ids(r)).toEqual(expected.sort())
    expect(r.fragment).toBe(false)
    expect(r.label).toBe(`${name}-vorher.html`)
  })

  it("after: the corrected form has no findings", () => {
    const r = analyzeHtml(example(`${name}-nachher.html`))
    expect(r.findings).toEqual([])
    expect(r.notes).toEqual([])
    expect(r.fields).toBeGreaterThan(1)
    expect(r.criteria.every((c) => c.state === "ok")).toBe(true)
  })
})

describe("findings", () => {
  const r = analyzeHtml(example("kontakt-vorher.html"))

  it("carry criterion, severity, explanation and fix", () => {
    for (const f of r.findings) {
      expect(f.crit === "empfehlung" || f.crit in CRITERIA).toBe(true)
      expect(SEVERITIES).toContain(f.sev)
      expect(f.explain.length).toBeGreaterThan(40)
      expect(f.fix.length).toBeGreaterThan(10)
      expect(f.items.length).toBeGreaterThan(0)
      expect(RULES[f.id].title).toBe(f.title)
    }
  })

  it("are sorted by severity", () => {
    const order = r.findings.map((f) => SEVERITIES.indexOf(f.sev))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it("point to the affected element with context", () => {
    const f = r.findings.find((x) => x.id === "field-no-name")!
    expect(f.crit).toBe("4.1.2")
    expect(f.sev).toBe("kritisch")
    expect(f.items[0].snippet).toBe('<input type="email" name="email">')
    expect(f.items[0].context).toBe("Formular 1 („Ihre Angaben“)")
  })

  it("count fields, forms and severities", () => {
    expect(r.forms).toEqual([{ index: 1, label: "Ihre Angaben", fields: 6, kind: "formular" }])
    expect(r.counts).toEqual({ kritisch: 2, hoch: 3, mittel: 4, hinweis: 3 })
    expect(r.places).toBe(r.findings.reduce((n, f) => n + f.items.length, 0))
  })

  it("the bundled EXAMPLE_HTML is the contact form before the fix", () => {
    expect(ids(analyzeHtml(EXAMPLE_HTML))).toEqual(ids(r))
  })
})

describe("input variants", () => {
  it("accepts a Document", () => {
    const html = example("kontakt-vorher.html")
    const fromDoc = analyze(parseHtml(html))
    expect(fromDoc.source).toBe("document")
    expect(ids(fromDoc)).toEqual(ids(analyze(html)))
  })

  it("detects fragments and skips page-level rules", () => {
    const r = analyzeHtml('<form><input name="q" type="text"><input type="email" name="mail"><button>Los</button></form>')
    expect(r.fragment).toBe(true)
    expect(ids(r)).not.toContain("lang-missing")
    expect(ids(r)).not.toContain("title-missing")
    expect(r.notes.some((n) => n.includes("Ausschnitt"))).toBe(true)
  })

  it("reports pages without forms", () => {
    const r = analyzeHtml('<!doctype html><html lang="de"><head><title>Start</title></head><body><h1>Willkommen</h1></body></html>')
    expect(r.fields).toBe(0)
    expect(r.findings).toEqual([])
    expect(r.notes[0]).toContain("kein sichtbares Formularfeld")
  })

  it("skips honeypot fields", () => {
    const r = analyzeHtml(
      '<!doctype html><html lang="de"><head><title>T</title></head><body><h1>T</h1><form><div role="status"></div><label for="n">Nachricht</label><textarea id="n" name="n"></textarea><div class="hp" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div><button>Senden</button></form></body></html>'
    )
    expect(r.findings).toEqual([])
    expect(r.skipped.honeypot).toBe(1)
  })

  it("does not execute scripts", () => {
    const r = analyzeHtml('<!doctype html><html lang="de"><head><title>T</title><script>document.title = "verändert"</script></head><body><h1>T</h1></body></html>')
    expect(r.title).toBe("T")
  })
})
