// Einstieg für Node.js: liest HTML mit jsdom. Skripte laufen dabei nicht, und es werden keine
// Bilder, Stylesheets oder Rahmen nachgeladen.

import { JSDOM, VirtualConsole } from "jsdom"
import { analyzeDocument, analyzeHtml as analyzeWith, type AnalyzeOptions, type Report } from "./analyze.js"

export * from "./index.js"

/** HTML-Text in ein Document laden, ohne Skripte und ohne Nachladen */
export function parseHtml(html: string): Document {
  // Eigene, stumme Konsole: Meldungen der Seite (etwa zu fehlerhaftem CSS) landen nicht in der Ausgabe
  const dom = new JSDOM(html, { contentType: "text/html", virtualConsole: new VirtualConsole() })
  return dom.window.document
}

/** HTML-Text prüfen; ohne Angabe von opts.parse mit jsdom */
export function analyzeHtml(html: string, opts: AnalyzeOptions = {}): Report {
  return analyzeWith(html, { parse: parseHtml, ...opts })
}

/** Text oder Document prüfen */
export function analyze(input: string | Document, opts: AnalyzeOptions = {}): Report {
  return typeof input === "string" ? analyzeHtml(input, opts) : analyzeDocument(input, opts)
}
