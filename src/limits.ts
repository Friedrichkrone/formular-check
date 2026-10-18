// Was der Formular-Check je Kriterium tatsächlich prüft, und was er grundsätzlich nicht kann.

import type { CritId } from "./criteria.js"

export const CHECK_SCOPE: Record<CritId, string> = {
  "1.1.1": "Alternativtexte von Grafik-Schaltern und Bildern in Formularen, Bild-CAPTCHAs",
  "1.3.1": "Verknüpfung von Beschriftungen, Optionsgruppen, Pflichtangaben, ids",
  "1.3.5": "autocomplete bei erkennbar persönlichen Angaben",
  "1.4.4": "Zoom-Sperre in der viewport-Angabe",
  "2.1.1": "Klickflächen ohne Tastaturzugang, die im HTML erkennbar sind",
  "2.2.1": "automatisches Neuladen und Hinweise auf Zeitlimits",
  "2.4.2": "Seitentitel vorhanden",
  "2.4.3": "positiver tabindex",
  "2.4.4": "Links in Formularen ohne Namen",
  "2.4.6": "leere Überschriften",
  "2.4.7": "entfernter Fokusrahmen im HTML und im eingebetteten CSS",
  "2.5.3": "sichtbarer Text im aria-label",
  "3.1.1": "Sprachangabe am html-Element",
  "3.2.2": "Absenden oder Seitenwechsel beim Ändern einer Auswahl",
  "3.3.1": "Fehlermarkierung und Verknüpfung vorhandener Fehlermeldungen",
  "3.3.2": "sichtbare Beschriftung statt Platzhalter, Erklärung von Sternchen",
  "3.3.8": "Aufgaben und Einfügesperren in Anmeldeformularen",
  "4.1.2": "Namen von Feldern, Schaltern und Rahmen",
  "4.1.3": "Live-Regionen für Meldungen",
}

export const LIMITS: string[] = [
  "Es wird kein JavaScript ausgeführt. Formulare, die erst im Browser entstehen, und Fehlermeldungen nach dem Absenden sind nicht sichtbar. Prüfen Sie dafür das HTML aus den Entwicklerwerkzeugen des Browsers.",
  "Externe Stylesheets werden nicht geladen. Kontraste von Text, Rahmen und Fokus, die Darstellung beim Vergrößern und per CSS versteckte Elemente sind nicht geprüft.",
  "Fokusreihenfolge, Tastaturbedienung eigener Bedienelemente und die Ansage im Screenreader lassen sich nur von Hand prüfen.",
  "Ob Beschriftungen, Hilfetexte und Fehlermeldungen verständlich sind, beurteilt nur ein Mensch.",
  "Automatische Prüfungen finden nur einen Teil der Barrieren. Diese Prüfung ersetzt keinen BITV-Test und keine Prüfung nach EN 301 549 und ist kein Zertifikat.",
]
