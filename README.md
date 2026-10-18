# formular-check

Static accessibility check for HTML forms. Give it an HTML string or a `Document`; it returns findings with the WCAG 2.2 success criterion, a severity, an explanation in plain language and a fix with a code example. Comes as a TypeScript library and as a command line tool.

* Hosted version: [schwerpunkt.tech/werkzeuge/formular-barrierefreiheit-pruefen](https://schwerpunkt.tech/werkzeuge/formular-barrierefreiheit-pruefen)
* Publisher: Schwerpunkt FdG Labs UG (haftungsbeschränkt), Berlin, [schwerpunkt.tech](https://schwerpunkt.tech)
* License: MIT

## What it does

* Checks what can be decided reliably from the HTML source alone, with a focus on forms: missing or invisible labels, placeholder as the only label, `autocomplete` for personal data (WCAG 1.3.5), radio and checkbox groups without `fieldset` and `legend`, unexplained asterisks, buttons and links without names, image buttons and images without `alt`, CAPTCHAs and puzzles in login forms (WCAG 3.3.8), blocked pasting, positive `tabindex`, removed focus outlines, zoom lock, automatic refresh, `onchange` navigation, clickable `div` elements, `aria-invalid` without message, missing live regions, page language, page title and headings. 45 rules in total, listed below.
* Recognises situations that often cause false alarms and leaves them out or marks them as hints: honeypot fields, elements hidden with `hidden` or `display:none`, screen reader only labels, names set by JavaScript frameworks and known CAPTCHA services. Findings outside forms, for example in a cookie banner, are labelled with their location.
* Every finding contains:
  * `crit`: the WCAG 2.2 success criterion (for example `1.3.5`), or `empfehlung` for W3C recommendations that are not a WCAG failure
  * `sev`: severity `kritisch` (critical), `hoch` (high), `mittel` (medium) or `hinweis` (hint: cannot be decided statically, check by hand)
  * `title`, `explain`, `fix` and usually `code` with a corrected example
  * `items`: the affected elements as short HTML snippets with their context (which form, header, footer)
* The report also lists the forms found, the status per WCAG criterion and notes about what could not be checked.
* The command line tool prints a text report, a summary line or JSON, reads files or standard input and returns an exit code for CI pipelines.

## What it does not do

* No JavaScript is executed. Forms that are created in the browser and error messages that appear after submitting are not visible. Check the HTML from the browser's developer tools for those.
* External stylesheets are not loaded. Contrast, layout when zoomed and elements hidden by CSS are not checked.
* Focus order, keyboard operation of custom widgets and screen reader output need a manual test.
* Whether labels, help texts and error messages are understandable can only be judged by a person.
* Automated checks find only part of the barriers. This is not a BITV test, not an audit according to EN 301 549 and not a certificate.
* It does not fetch web pages. Save the HTML first, for example with "Save page as" in the browser.
* Titles, explanations and fixes are written in German, because the tool was built for German organisations. Rule IDs, the API and the CLI options are in English.

## Installation

The package is not published to npm yet. Build it from source:

```sh
git clone https://github.com/Friedrichkrone/formular-check.git formular-check
cd formular-check
npm install
npm test
npm run build
```

Requirements: Node.js 22.12 or newer. The only runtime dependency is [jsdom](https://github.com/jsdom/jsdom), used to parse HTML in Node.js.

To use the command globally from the cloned folder: `npm link`, then `formular-check --help`.

## Usage

### Command line

```sh
node dist/cli.js examples/kontakt-vorher.html          # full text report (German)
node dist/cli.js --summary examples/*.html             # one line per file
node dist/cli.js --json page.html > report.json        # machine readable
cat form.html | node dist/cli.js --fragment -          # read a snippet from standard input
node dist/cli.js --fail-on hoch page.html              # fail only on critical and high findings
```

| Option | Meaning |
| --- | --- |
| `--json` | Print the report as JSON (an array if several files are given). |
| `--summary` | Print one summary line per file. |
| `--fail-on <level>` | Exit with code 1 if a finding of this severity or higher exists: `kritisch`, `hoch`, `mittel` (default), `hinweis` or `never`. English names (`critical`, `high`, `medium`, `hint`) work too. |
| `--fragment` | Treat the input as a fragment: language, title and heading structure are not checked. |
| `-h`, `--help` / `-v`, `--version` | Help and version. |

Exit codes: `0` no findings at or above `--fail-on`, `1` findings, `2` usage or read error.

### Library in Node.js

```ts
import { analyzeHtml, textReport } from "@schwerpunkt/formular-check/node"

const report = analyzeHtml(html, { label: "kontakt.html" })
for (const f of report.findings) {
  console.log(f.sev, f.crit, f.title)
  for (const item of f.items) console.log("  ", item.snippet, item.context)
}
console.log(textReport(report))
```

### Library in the browser

The main entry point has no Node.js dependencies and uses the browser's `DOMParser`:

```ts
import { analyze } from "@schwerpunkt/formular-check"

const fromText = analyze("<form>…</form>")              // fragment, parsed in a separate document
const fromPage = analyze(document, { label: location.href })
```

Parsing with `DOMParser` creates a separate document: scripts in it do not run and images, stylesheets and frames are not loaded.

### API overview

| Export | Purpose |
| --- | --- |
| `analyze(input, options)` | `input` is an HTML string or a `Document`. Returns a `Report`. |
| `analyzeHtml(html, options)`, `analyzeDocument(doc, options)` | The same, for one input type. |
| `textReport(report)`, `summaryLine(report)` | Plain text output (German). |
| `RULES`, `CRITERIA`, `SEVERITIES`, `CHECK_SCOPE`, `LIMITS` | Rule texts, WCAG criteria, scope and limits of the check. |
| `parseHtml(html)` | Only in `./node`: HTML to `Document` with jsdom, without scripts and resources. |

Options: `label` (name of the source in the report), `fragment` (detected automatically for strings), `parse` (custom HTML parser).

## Examples

`examples/` contains three forms, each before and after the fix. They double as test cases.

| Example | Before | After |
| --- | --- | --- |
| Contact form | `kontakt-vorher.html`: 12 findings | `kontakt-nachher.html`: none |
| Login | `anmeldung-vorher.html`: 6 findings | `anmeldung-nachher.html`: none |
| Order form | `bestellung-vorher.html`: 14 findings | `bestellung-nachher.html`: none |

## Rules

<details>
<summary>All 45 rules with WCAG criterion and severity</summary>

| Rule | WCAG 2.2 | Severity | Title (German) |
| --- | --- | --- | --- |
| `field-no-name` | 4.1.2 (A) | critical | Formularfeld ohne Beschriftung |
| `placeholder-only` | 3.3.2 (A) | high | Platzhalter als einzige Beschriftung |
| `title-only` | 3.3.2 (A) | hint | Beschriftung nur im title-Attribut |
| `no-visible-label` | 3.3.2 (A) | hint | Keine sichtbare Beschriftung erkennbar |
| `label-in-name` | 2.5.3 (A) | medium | Sichtbarer Text fehlt im zugänglichen Namen |
| `label-for-missing` | 1.3.1 (A) | medium | Beschriftung zeigt ins Leere |
| `duplicate-id` | 1.3.1 (A) | medium | Doppelte id bei verknüpften Elementen |
| `aria-ref-missing` | 1.3.1 (A) | hint | Verweis auf eine nicht vorhandene id |
| `autocomplete` | 1.3.5 (AA) | medium | Eingabezweck nicht hinterlegt (autocomplete) |
| `group-no-fieldset` | 1.3.1 (A) | medium | Optionsgruppe ohne gemeinsame Frage |
| `required-asterisk` | 3.3.2 (A) | medium | Sternchen für Pflichtfelder ohne Erklärung |
| `required-hidden-star` | 1.3.1 (A) | medium | Pflichtfeld nur optisch gekennzeichnet |
| `button-no-name` | 4.1.2 (A) | critical | Schalter ohne Namen |
| `button-weak-name` | 4.1.2 (A) | hint | Schalter, dessen Name nur ein Zeichen ist |
| `image-button-no-alt` | 1.1.1 (A) | critical | Grafik-Schalter ohne Alternativtext |
| `img-no-alt` | 1.1.1 (A) | high | Bild im Formular ohne Alternativtext |
| `link-no-name` | 2.4.4 (A) | high | Link im Formular ohne Namen |
| `captcha-image` | 1.1.1 (A) | high | Bild-CAPTCHA ohne erkennbare Alternative |
| `captcha-auth` | 3.3.8 (AA) | high | Rätsel oder Abtippen bei der Anmeldung |
| `captcha-widget` | 1.1.1 (A) | hint | CAPTCHA-Dienst eingebunden |
| `captcha-widget-auth` | 3.3.8 (AA) | hint | CAPTCHA-Dienst in einer Anmeldung |
| `captcha-quiz` | recommendation | hint | Rechen- oder Quizaufgabe als Spamschutz |
| `paste-blocked` | 3.3.8 (AA) | high | Einfügen im Passwort- oder Codefeld gesperrt |
| `tabindex-positive` | 2.4.3 (A) | medium | Positiver tabindex |
| `outline-inline` | 2.4.7 (AA) | high | Fokusrahmen im style-Attribut entfernt |
| `outline-css` | 2.4.7 (AA) | hint | Fokusrahmen per CSS entfernt, ohne Ersatz in derselben Regel |
| `meta-refresh` | 2.2.1 (A) | high | Seite lädt sich automatisch neu oder leitet weiter |
| `viewport-zoom` | 1.4.4 (AA) | medium | Vergrößern auf dem Handy gesperrt |
| `timeout-text` | 2.2.1 (A) | hint | Hinweis auf ein Zeitlimit gefunden |
| `onchange-context` | 3.2.2 (A) | medium | Auswahl löst sofort Absenden oder Seitenwechsel aus |
| `fake-button` | 2.1.1 (A) | critical | Klickbares Element nicht per Tastatur erreichbar |
| `fake-submit` | 4.1.2 (A) | high | Absende-Knopf vermutlich kein echter Schalter |
| `no-submit` | 2.1.1 (A) | hint | Kein Absende-Schalter im HTML |
| `aria-hidden-focus` | 4.1.2 (A) | hint | Eingabefeld für Screenreader versteckt |
| `iframe-no-title` | 4.1.2 (A) | medium | Eingebetteter Rahmen ohne Titel |
| `invalid-no-message` | 3.3.1 (A) | medium | Feld als fehlerhaft markiert, ohne verknüpfte Meldung |
| `error-unlinked` | 3.3.1 (A) | hint | Fehlermeldung nicht mit dem Feld verbunden |
| `no-live-region` | 4.1.3 (AA) | hint | Keine Live-Region für Meldungen erkennbar |
| `lang-missing` | 3.1.1 (A) | high | Sprache der Seite fehlt |
| `lang-invalid` | 3.1.1 (A) | medium | Sprachangabe hat kein gültiges Format |
| `title-missing` | 2.4.2 (A) | medium | Seite ohne Titel |
| `heading-empty` | 2.4.6 (AA) | medium | Leere Überschrift |
| `headings-none` | recommendation | hint | Keine Überschriften auf der Seite |
| `heading-no-h1` | recommendation | hint | Keine Hauptüberschrift (h1) |
| `heading-skip` | recommendation | hint | Überschriftenebenen übersprungen |

</details>

## Privacy

* The check runs locally. The library and the CLI make no network requests and store nothing.
* The HTML is parsed into a separate document without executing scripts and without loading images, stylesheets or frames (jsdom in Node.js, `DOMParser` in the browser).
* The CLI only reads the files you name or standard input. Reports contain short snippets of the checked HTML, so treat them like the page itself.

## Contributing

Bug reports with a minimal HTML example and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE). Copyright 2026 Schwerpunkt FdG Labs UG (haftungsbeschränkt).

## Deutsch

**formular-check** prüft HTML-Formulare statisch auf Barrieren nach WCAG 2.2: fehlende Beschriftungen, Platzhalter statt Label, `autocomplete`, Optionsgruppen ohne `fieldset`, Schalter ohne Namen, CAPTCHAs bei der Anmeldung, entfernte Fokusrahmen, Zoom-Sperre und mehr. Jeder Befund nennt Kriterium, Schwere, Erklärung und Lösung mit Codebeispiel. Bibliothek für Browser und Node.js sowie Kommandozeile `formular-check <datei.html>`.

Was es nicht kann: Es führt kein JavaScript aus, lädt keine externen Stylesheets und keine Webseiten. Kontraste, Fokusreihenfolge und Verständlichkeit prüft nur ein Mensch. Kein BITV-Test, keine Prüfung nach EN 301 549, kein Zertifikat.

Installation: `npm install`, `npm test`, `npm run build`, danach `node dist/cli.js examples/kontakt-vorher.html`.

Datenschutz: Die Prüfung läuft lokal, ohne Netzwerkzugriffe und ohne Speichern.

Die gehostete Fassung mit Abruf über eine Adresse steht unter [schwerpunkt.tech/werkzeuge/formular-barrierefreiheit-pruefen](https://schwerpunkt.tech/werkzeuge/formular-barrierefreiheit-pruefen).
Herausgeber: Schwerpunkt FdG Labs UG (haftungsbeschränkt), Berlin, [schwerpunkt.tech](https://schwerpunkt.tech).
