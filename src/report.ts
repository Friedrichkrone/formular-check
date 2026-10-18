// Ergebnis als reiner Text, zum Kopieren und Speichern.

import type { Report } from "./analyze.js"
import { CRITERIA, critLabel, quickRef } from "./criteria.js"
import { SEVERITIES, SEVERITY_LABEL } from "./rules.js"
import { CHECK_SCOPE, LIMITS } from "./limits.js"

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function summaryLine(r: Report): string {
  const total = r.findings.length
  const parts = SEVERITIES.filter((s) => r.counts[s]).map((s) =>
    s === "hinweis" ? `${r.counts[s]} ${r.counts[s] === 1 ? "Hinweis" : "Hinweise"}` : `${r.counts[s]} ${SEVERITY_LABEL[s].toLowerCase()}`
  )
  return `${r.forms.length} ${r.forms.length === 1 ? "Formular" : "Formulare"}, ${r.fields} ${r.fields === 1 ? "Feld" : "Felder"}, ${total} ${total === 1 ? "Befund" : "Befunde"}${parts.length ? ` (${parts.join(", ")})` : ""}`
}

export function textReport(r: Report): string {
  const L: string[] = []
  L.push("Formular-Check Barrierefreiheit (statische Prüfung)")
  L.push("Werkzeug: formular-check, Online-Fassung: https://schwerpunkt.tech/werkzeuge/formular-barrierefreiheit-pruefen")
  L.push("")
  L.push(`Geprüft: ${r.label ?? (r.source === "document" ? "übergebenes Dokument" : "HTML-Quelltext")}`)
  L.push(`Zeitpunkt: ${formatDate(r.checkedAt)}`)
  if (r.title) L.push(`Seitentitel: ${r.title}`)
  L.push(`Ergebnis: ${summaryLine(r)}`)
  if (r.forms.length) {
    L.push("")
    L.push("Formulare:")
    for (const f of r.forms) L.push(`  Formular ${f.index}${f.label ? ` („${f.label}“)` : ""}: ${f.fields} ${f.fields === 1 ? "Feld" : "Felder"}${f.kind === "suche" ? ", Suche" : f.kind === "anmeldung" ? ", Anmeldung" : ""}`)
    if (r.fieldsOutside) L.push(`  Außerhalb eines form-Elements: ${r.fieldsOutside} ${r.fieldsOutside === 1 ? "Feld" : "Felder"}`)
  }
  if (r.notes.length) {
    L.push("")
    L.push("Bitte beachten:")
    for (const n of r.notes) L.push(`  - ${n}`)
  }
  for (const sev of SEVERITIES) {
    const list = r.findings.filter((f) => f.sev === sev)
    if (!list.length) continue
    L.push("")
    L.push(`==== ${SEVERITY_LABEL[sev].toUpperCase()} (${list.length}) ====`)
    for (const f of list) {
      L.push("")
      L.push(`${f.title}`)
      if (f.crit === "empfehlung") L.push(`Empfehlung, kein WCAG-Verstoß${f.ref ? `: ${f.ref.label}, ${f.ref.url}` : ""}`)
      else L.push(`WCAG 2.2, ${critLabel(f.crit)}: ${quickRef(f.crit)}`)
      L.push(`Betroffen (${f.items.length}${f.items.length >= 60 ? "+" : ""}):`)
      for (const it of f.items) {
        const head = [it.note, it.context].filter(Boolean).join(" · ")
        L.push(`  - ${head || "Seite"}`)
        if (it.snippet) L.push(`    ${it.snippet}`)
      }
      L.push(`Warum: ${f.explain}`)
      L.push(`Lösung: ${f.fix}`)
      if (f.code) {
        L.push("Beispiel:")
        for (const line of f.code.split("\n")) L.push(`    ${line}`)
      }
    }
  }
  const ok = r.criteria.filter((c) => c.state === "ok")
  if (ok.length) {
    L.push("")
    L.push("Ohne Befund, soweit statisch prüfbar:")
    for (const c of ok) L.push(`  ${CRITERIA[c.id].num} ${CRITERIA[c.id].name}: ${CHECK_SCOPE[c.id]}`)
  }
  L.push("")
  L.push("Grenzen dieser Prüfung:")
  for (const l of LIMITS) L.push(`  - ${l}`)
  return L.join("\n")
}
