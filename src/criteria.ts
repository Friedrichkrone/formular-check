// WCAG-2.2-Kriterien, die der Formular-Check (teilweise) prüft.
// Deutsche Namen nach der deutschen Übersetzung der WCAG 2.1 (Aktion Mensch, 2022), für 3.3.8
// eigene Übersetzung. Eine autorisierte deutsche Fassung von WCAG 2.2 gibt es laut W3C noch nicht
// (Übersicht https://www.w3.org/WAI/standards-guidelines/wcag/translations/, abgerufen am
// 18.10.2026). Verlinkt wird deshalb die WCAG 2.2 Quick Reference des W3C (englisch).

export type Level = "A" | "AA"

export interface Criterion {
  num: string
  name: string
  level: Level
  slug: string
}

export const CRITERIA = {
  "1.1.1": { num: "1.1.1", name: "Nicht-Text-Inhalt", level: "A", slug: "non-text-content" },
  "1.3.1": { num: "1.3.1", name: "Info und Beziehungen", level: "A", slug: "info-and-relationships" },
  "1.3.5": { num: "1.3.5", name: "Bestimmung des Eingabezwecks", level: "AA", slug: "identify-input-purpose" },
  "1.4.4": { num: "1.4.4", name: "Textgröße ändern", level: "AA", slug: "resize-text" },
  "2.1.1": { num: "2.1.1", name: "Tastatur", level: "A", slug: "keyboard" },
  "2.2.1": { num: "2.2.1", name: "Zeiteinteilung anpassbar", level: "A", slug: "timing-adjustable" },
  "2.4.2": { num: "2.4.2", name: "Seite mit Titel versehen", level: "A", slug: "page-titled" },
  "2.4.3": { num: "2.4.3", name: "Fokus-Reihenfolge", level: "A", slug: "focus-order" },
  "2.4.4": { num: "2.4.4", name: "Linkzweck (im Kontext)", level: "A", slug: "link-purpose-in-context" },
  "2.4.6": { num: "2.4.6", name: "Überschriften und Beschriftungen", level: "AA", slug: "headings-and-labels" },
  "2.4.7": { num: "2.4.7", name: "Fokus sichtbar", level: "AA", slug: "focus-visible" },
  "2.5.3": { num: "2.5.3", name: "Beschriftung im Namen", level: "A", slug: "label-in-name" },
  "3.1.1": { num: "3.1.1", name: "Sprache der Seite", level: "A", slug: "language-of-page" },
  "3.2.2": { num: "3.2.2", name: "Bei Eingabe", level: "A", slug: "on-input" },
  "3.3.1": { num: "3.3.1", name: "Fehlererkennung", level: "A", slug: "error-identification" },
  "3.3.2": { num: "3.3.2", name: "Beschriftungen oder Anweisungen", level: "A", slug: "labels-or-instructions" },
  "3.3.8": { num: "3.3.8", name: "Zugängliche Authentifizierung (Minimum)", level: "AA", slug: "accessible-authentication-minimum" },
  "4.1.2": { num: "4.1.2", name: "Name, Rolle, Wert", level: "A", slug: "name-role-value" },
  "4.1.3": { num: "4.1.3", name: "Statusmeldungen", level: "AA", slug: "status-messages" },
} as const satisfies Record<string, Criterion>

export type CritId = keyof typeof CRITERIA

/** Befunde ohne verletztes Kriterium (Empfehlung); verweisen auf eine W3C-Quelle. */
export type CritRef = CritId | "empfehlung"

export const quickRef = (id: CritId) => `https://www.w3.org/WAI/WCAG22/quickref/#${CRITERIA[id].slug}`

export function critLabel(id: CritId): string {
  const c = CRITERIA[id]
  return `${c.num} ${c.name} (Stufe ${c.level})`
}

/** Sortierschlüssel 1.3.5 → 01.03.05 */
export const critSort = (id: string) =>
  id
    .split(".")
    .map((x) => x.padStart(2, "0"))
    .join(".")
