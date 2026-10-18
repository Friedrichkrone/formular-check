// Texte der Prüfregeln: Kriterium, Schwere, Erklärung in einfachem Deutsch, Lösung mit Beispiel.
// Beschränkt auf das, was sich am HTML ohne CSS, Layout und JavaScript sicher erkennen lässt.

import type { CritRef } from "./criteria.js"

export type Severity = "kritisch" | "hoch" | "mittel" | "hinweis"

export const SEVERITIES: Severity[] = ["kritisch", "hoch", "mittel", "hinweis"]

export const SEVERITY_LABEL: Record<Severity, string> = {
  kritisch: "Kritisch",
  hoch: "Hoch",
  mittel: "Mittel",
  hinweis: "Hinweis",
}

export const SEVERITY_TEXT: Record<Severity, string> = {
  kritisch: "verhindert die Nutzung für manche Menschen meist ganz",
  hoch: "erschwert die Nutzung erheblich",
  mittel: "erschwert die Nutzung oder ist ein Risiko",
  hinweis: "statisch nicht sicher zu entscheiden, bitte von Hand prüfen",
}

export interface RuleDef {
  crit: CritRef
  sev: Severity
  title: string
  explain: string
  fix: string
  code?: string
  /** Quelle für Empfehlungen ohne verletztes Kriterium */
  ref?: { label: string; url: string }
}

const FOCUS_CSS = `input:focus-visible,
select:focus-visible,
textarea:focus-visible,
button:focus-visible {
  outline: 3px solid #1a56db;
  outline-offset: 2px;
}`

export const RULES = {
  "field-no-name": {
    crit: "4.1.2",
    sev: "kritisch",
    title: "Formularfeld ohne Beschriftung",
    explain:
      "Das Feld hat keinen zugänglichen Namen. Ein Screenreader sagt nur „Eingabefeld“ oder „Auswahl“, aber nicht, was hinein gehört. Auch per Sprachsteuerung lässt sich das Feld nicht ansprechen.",
    fix: "Geben Sie jedem Feld eine sichtbare Beschriftung mit einem label-Element, dessen for-Attribut auf die id des Felds zeigt. Nur wenn das nicht geht: aria-labelledby oder aria-label.",
    code: `<label for="email">E-Mail-Adresse</label>
<input id="email" name="email" type="email" autocomplete="email">`,
  },
  "placeholder-only": {
    crit: "3.3.2",
    sev: "hoch",
    title: "Platzhalter als einzige Beschriftung",
    explain:
      "Der Platzhalter (placeholder) verschwindet, sobald jemand tippt. Danach ist nicht mehr zu sehen, was ins Feld gehört. Platzhalter sind oft blass, und nicht jeder Screenreader liest sie als Beschriftung vor.",
    fix: "Setzen Sie eine sichtbare Beschriftung über das Feld. Den Platzhalter können Sie für ein Beispiel behalten.",
    code: `<label for="plz">Postleitzahl</label>
<input id="plz" name="plz" inputmode="numeric" autocomplete="postal-code" placeholder="z. B. 10115">`,
  },
  "title-only": {
    crit: "3.3.2",
    sev: "hinweis",
    title: "Beschriftung nur im title-Attribut",
    explain:
      "Der Name des Felds kommt nur aus dem title-Attribut. Der Text erscheint als Tooltip, wenn jemand mit der Maus über das Feld fährt; auf dem Handy und mit der Tastatur ist er nicht zu sehen. Steht direkt am Feld ein sichtbarer Text, der es erklärt, kann das ausreichen.",
    fix: "Ergänzen Sie eine sichtbare Beschriftung mit label.",
    code: `<label for="firma">Firma</label>
<input id="firma" name="firma" autocomplete="organization">`,
  },
  "no-visible-label": {
    crit: "3.3.2",
    sev: "hinweis",
    title: "Keine sichtbare Beschriftung erkennbar",
    explain:
      "Das Feld hat einen Namen für Screenreader (aria-label oder eine nur für Screenreader sichtbare Beschriftung), im HTML ist aber keine sichtbare Beschriftung zu finden. Sehende sehen dann höchstens den Platzhalter, der beim Tippen verschwindet. Ob CSS die Beschriftung doch anzeigt, kann diese Prüfung nicht sehen.",
    fix: "Zeigen Sie die Beschriftung sichtbar an, am besten als label über dem Feld.",
    code: `<label for="name">Vor- und Nachname</label>
<input id="name" name="name" autocomplete="name">`,
  },
  "label-in-name": {
    crit: "2.5.3",
    sev: "mittel",
    title: "Sichtbarer Text fehlt im zugänglichen Namen",
    explain:
      "Der Name für Hilfsmittel (aria-label oder aria-labelledby) enthält den sichtbaren Text nicht. Wer per Sprachsteuerung „Klicke Senden“ sagt, erreicht das Element dann nicht, und der Screenreader sagt etwas anderes an, als zu sehen ist.",
    fix: "Entfernen Sie das aria-label, wenn der sichtbare Text reicht, oder lassen Sie es mit dem sichtbaren Text beginnen.",
    code: `<!-- statt -->
<button aria-label="Formular übermitteln">Senden</button>
<!-- besser -->
<button>Senden</button>`,
  },
  "label-for-missing": {
    crit: "1.3.1",
    sev: "mittel",
    title: "Beschriftung zeigt ins Leere",
    explain:
      "Das for-Attribut der Beschriftung verweist auf eine id, die es nicht gibt oder die zu keinem Formularfeld gehört. Die Beschriftung ist dann mit keinem Feld verbunden: Ein Klick auf den Text setzt keinen Fokus, und Screenreader lesen sie beim Feld nicht vor.",
    fix: "Gleichen Sie for und id ab. Jede id darf auf der Seite nur einmal vorkommen.",
    code: `<label for="telefon">Telefon</label>
<input id="telefon" name="telefon" type="tel" autocomplete="tel">`,
  },
  "duplicate-id": {
    crit: "1.3.1",
    sev: "mittel",
    title: "Doppelte id bei verknüpften Elementen",
    explain:
      "Mehrere Elemente tragen dieselbe id, und eine Beschriftung oder Beschreibung verweist darauf. Browser verbinden den Verweis nur mit dem ersten Element. Das andere Feld bleibt ohne Beschriftung oder bekommt die falsche.",
    fix: "Vergeben Sie eindeutige ids, zum Beispiel mit einem Präfix je Formular.",
    code: `<label for="newsletter-email">E-Mail</label>
<input id="newsletter-email" type="email" autocomplete="email">`,
  },
  "aria-ref-missing": {
    crit: "1.3.1",
    sev: "hinweis",
    title: "Verweis auf eine nicht vorhandene id",
    explain:
      "aria-labelledby oder aria-describedby verweist auf eine id, die im HTML nicht vorkommt. Vielleicht legt JavaScript das Element später an, etwa eine Fehlermeldung. Wenn nicht, fehlt dem Feld die Beschriftung oder Beschreibung.",
    fix: "Prüfen Sie im Browser, ob ein Element mit dieser id erscheint. Sonst korrigieren oder entfernen Sie den Verweis.",
    code: `<input id="iban" name="iban" aria-describedby="iban-hinweis">
<p id="iban-hinweis">22 Zeichen, beginnt mit DE</p>`,
  },
  autocomplete: {
    crit: "1.3.5",
    sev: "mittel",
    title: "Eingabezweck nicht hinterlegt (autocomplete)",
    explain:
      "Felder für persönliche Angaben wie Name, E-Mail, Anschrift oder Telefon brauchen das passende autocomplete-Attribut. Dann füllen Browser die Daten auf Wunsch aus, und Hilfsmittel können den Zweck anzeigen. Das hilft Menschen mit motorischen oder kognitiven Einschränkungen. Die Regel gilt für Angaben über die Person, die das Formular ausfüllt.",
    fix: "Ergänzen Sie den passenden Wert aus der HTML-Norm. Entfernen Sie autocomplete=\"off\" bei persönlichen Angaben.",
    code: `<input id="vorname" name="vorname" autocomplete="given-name">
<input id="nachname" name="nachname" autocomplete="family-name">
<input id="email" name="email" type="email" autocomplete="email">
<input id="strasse" name="strasse" autocomplete="street-address">
<input id="plz" name="plz" autocomplete="postal-code">
<input id="ort" name="ort" autocomplete="address-level2">`,
  },
  "group-no-fieldset": {
    crit: "1.3.1",
    sev: "mittel",
    title: "Optionsgruppe ohne gemeinsame Frage",
    explain:
      "Die Antwortmöglichkeiten sind nicht mit ihrer Frage verbunden. Ein Screenreader liest dann nur „Ja, Optionsfeld“ vor, ohne die Frage dazu. Gibt es mehrere Gruppen, ist nicht klar, welches Ja zu welcher Frage gehört.",
    fix: "Fassen Sie zusammengehörige Optionsfelder oder Kontrollkästchen in ein fieldset und schreiben Sie die Frage in das legend-Element.",
    code: `<fieldset>
  <legend>Wie möchten Sie kontaktiert werden?</legend>
  <input type="radio" id="k-mail" name="kontakt" value="mail">
  <label for="k-mail">E-Mail</label>
  <input type="radio" id="k-tel" name="kontakt" value="tel">
  <label for="k-tel">Telefon</label>
</fieldset>`,
  },
  "required-asterisk": {
    crit: "3.3.2",
    sev: "mittel",
    title: "Sternchen für Pflichtfelder ohne Erklärung",
    explain:
      "Pflichtfelder sind mit einem Sternchen markiert, aber im Text der Seite steht nicht, was es bedeutet. Nicht alle Menschen kennen diese Konvention, und Screenreader lesen nur „Stern“ vor.",
    fix: "Erklären Sie das Sternchen am Anfang des Formulars und markieren Sie Pflichtfelder auch im Code mit required.",
    code: `<p>Felder mit * sind Pflichtfelder.</p>
<label for="name">Name <span aria-hidden="true">*</span></label>
<input id="name" name="name" required autocomplete="name">`,
  },
  "required-hidden-star": {
    crit: "1.3.1",
    sev: "mittel",
    title: "Pflichtfeld nur optisch gekennzeichnet",
    explain:
      "Das Sternchen ist für Screenreader ausgeblendet (aria-hidden), und das Feld ist im Code nicht als Pflichtfeld markiert. Blinde Menschen erfahren so nicht, dass sie es ausfüllen müssen.",
    fix: "Markieren Sie das Feld mit required oder aria-required=\"true\".",
    code: `<label for="email">E-Mail <span aria-hidden="true">*</span></label>
<input id="email" name="email" type="email" required autocomplete="email">`,
  },
  "button-no-name": {
    crit: "4.1.2",
    sev: "kritisch",
    title: "Schalter ohne Namen",
    explain:
      "Der Schalter hat keinen Text und keine Beschriftung, oft ist nur ein Symbol zu sehen. Ein Screenreader sagt nur „Schalter“, aber nicht wofür. Sprachsteuerung findet ihn nicht.",
    fix: "Geben Sie dem Schalter sichtbaren Text. Bei reinen Symbolen hilft aria-label; das Symbol selbst blenden Sie mit aria-hidden aus.",
    code: `<button type="submit">Senden</button>

<button type="button" aria-label="Suche starten">
  <svg aria-hidden="true" focusable="false">…</svg>
</button>`,
  },
  "button-weak-name": {
    crit: "4.1.2",
    sev: "hinweis",
    title: "Schalter, dessen Name nur ein Zeichen ist",
    explain:
      "Der Name besteht nur aus einem Zeichen wie „×“, „+“ oder „›“. Screenreader lesen das als „mal“, „plus“ oder gar nicht vor. Was der Schalter tut, bleibt offen.",
    fix: "Geben Sie einen Namen, der die Aktion beschreibt.",
    code: `<button type="button" aria-label="Hinweis schließen">
  <span aria-hidden="true">×</span>
</button>`,
  },
  "image-button-no-alt": {
    crit: "1.1.1",
    sev: "kritisch",
    title: "Grafik-Schalter ohne Alternativtext",
    explain:
      "Ein Schalter als Bild (input type=\"image\") braucht einen Alternativtext. Ohne ihn sagt ein Screenreader nur „Schalter“ oder den Dateinamen.",
    fix: "Ergänzen Sie alt mit der Aktion, oder nehmen Sie einen normalen button.",
    code: `<input type="image" src="senden.png" alt="Anfrage senden">`,
  },
  "img-no-alt": {
    crit: "1.1.1",
    sev: "hoch",
    title: "Bild im Formular ohne Alternativtext",
    explain:
      "Das Bild hat kein alt-Attribut. Screenreader lesen dann oft den Dateinamen vor. Trägt das Bild eine Information, fehlt sie blinden Menschen.",
    fix: "Beschreiben Sie das Bild kurz in alt. Ist es nur Schmuck, setzen Sie alt=\"\".",
    code: `<img src="hinweis.svg" alt="Achtung">
<img src="linie.svg" alt="">`,
  },
  "link-no-name": {
    crit: "2.4.4",
    sev: "hoch",
    title: "Link im Formular ohne Namen",
    explain:
      "Der Link hat keinen Text, nur ein Symbol oder ein Bild ohne Alternativtext. Screenreader sagen dann nur „Link“ oder lesen die Adresse vor.",
    fix: "Geben Sie dem Link einen Text, der sein Ziel nennt.",
    code: `<a href="/datenschutz">Datenschutzerklärung</a>`,
  },
  "captcha-image": {
    crit: "1.1.1",
    sev: "hoch",
    title: "Bild-CAPTCHA ohne erkennbare Alternative",
    explain:
      "Bei diesem CAPTCHA tippt man Zeichen aus einem Bild ab. Das schließt blinde und viele sehbehinderte Menschen aus. WCAG 1.1.1 verlangt für CAPTCHAs einen Text, der den Zweck nennt, und eine Alternative in einer anderen Form, etwa per Audio. Eine solche Alternative ist im HTML nicht zu erkennen.",
    fix: "Am besten ersetzen Sie das Bild-CAPTCHA durch einen Spamschutz ohne Aufgabe, etwa ein verstecktes Feld mit Prüfung auf dem Server. Sonst: Alternativtext mit Zweck und eine Audio-Variante.",
    code: `<img src="captcha.php" alt="Sicherheitscode zum Abtippen. Audio-Variante unter dem Bild.">
<button type="button">Code vorlesen lassen</button>`,
  },
  "captcha-auth": {
    crit: "3.3.8",
    sev: "hoch",
    title: "Rätsel oder Abtippen bei der Anmeldung",
    explain:
      "Das Formular ist eine Anmeldung (es hat ein Passwortfeld) und verlangt eine Aufgabe zum Abtippen, Rechnen oder Beantworten. Nach WCAG 3.3.8 ist ein solcher Test bei der Anmeldung nur erlaubt, wenn es eine Alternative ohne Test oder eine Hilfe gibt. Ausgenommen ist das Erkennen von Objekten, etwa „Wählen Sie alle Bilder mit Ampeln“.",
    fix: "Bieten Sie eine Anmeldung ohne Rätsel an, etwa einen Bot-Schutz ohne Aufgabe, einen Anmeldelink per E-Mail oder Passkeys.",
    code: `<input type="password" id="passwort" name="passwort" autocomplete="current-password">`,
  },
  "captcha-widget": {
    crit: "1.1.1",
    sev: "hinweis",
    title: "CAPTCHA-Dienst eingebunden",
    explain:
      "Auf der Seite ist ein CAPTCHA-Dienst eingebunden. Ob Besucher eine Aufgabe lösen müssen, entscheidet der Dienst erst im Browser: Manche Varianten zeigen nichts an, andere ein Bilderrätsel mit Audio-Alternative. Das Formular hat kein Passwortfeld, ist also keine Anmeldung. WCAG 3.3.8 greift hier nicht, maßgeblich ist 1.1.1.",
    fix: "Füllen Sie das Formular einmal nur mit Tastatur und einmal mit Screenreader bis zum Absenden aus. Wenn möglich, wählen Sie eine Variante ohne Aufgabe für Menschen.",
  },
  "captcha-widget-auth": {
    crit: "3.3.8",
    sev: "hinweis",
    title: "CAPTCHA-Dienst in einer Anmeldung",
    explain:
      "Das Formular ist eine Anmeldung, und ein CAPTCHA-Dienst ist eingebunden. Nach WCAG 3.3.8 darf die Anmeldung keinen Test kognitiver Funktionen verlangen, also kein Abtippen, Rechnen oder Merken, ohne Alternative oder Hilfe. Das Erkennen von Objekten ist auf Stufe AA ausgenommen. Welche Aufgabe der Dienst stellt, zeigt sich erst im Browser.",
    fix: "Testen Sie die Anmeldung mit Tastatur und Screenreader. Wählen Sie, wenn möglich, eine Variante ohne Aufgabe.",
  },
  "captcha-quiz": {
    crit: "empfehlung",
    sev: "hinweis",
    title: "Rechen- oder Quizaufgabe als Spamschutz",
    explain:
      "Eine Rechenaufgabe oder Sicherheitsfrage ist für viele Menschen eine Hürde, etwa bei Dyskalkulie oder kognitiven Einschränkungen. In einem Formular ohne Anmeldung verletzt das kein bestimmtes WCAG-Kriterium, denn 3.3.8 gilt nur für Anmeldungen. Das W3C beschreibt die Probleme solcher Tests in einer eigenen Veröffentlichung.",
    fix: "Nutzen Sie einen Spamschutz ohne Aufgabe: ein verstecktes Feld (Honigtopf), eine Zeitprüfung oder eine Prüfung auf dem Server.",
    ref: { label: "W3C: Inaccessibility of CAPTCHA", url: "https://www.w3.org/TR/turingtest/" },
  },
  "paste-blocked": {
    crit: "3.3.8",
    sev: "hoch",
    title: "Einfügen im Passwort- oder Codefeld gesperrt",
    explain:
      "Das Feld verbietet das Einfügen (onpaste). Passwortmanager und kopierte Codes funktionieren dann nicht. Bei der Anmeldung muss man sich das Passwort merken oder es abtippen. Nach WCAG 3.3.8 ist das ohne Alternative nicht zulässig.",
    fix: "Entfernen Sie die Sperre und setzen Sie das passende autocomplete.",
    code: `<input type="password" id="passwort" autocomplete="current-password">
<input id="code" inputmode="numeric" autocomplete="one-time-code">`,
  },
  "tabindex-positive": {
    crit: "2.4.3",
    sev: "mittel",
    title: "Positiver tabindex",
    explain:
      "Ein tabindex größer als 0 zieht das Element in der Tab-Reihenfolge nach vorne. Die Reihenfolge passt dann oft nicht mehr zur sichtbaren Anordnung, und wer mit der Tastatur arbeitet, springt kreuz und quer durch die Seite.",
    fix: "Verwenden Sie nur tabindex=\"0\" oder tabindex=\"-1\". Ordnen Sie die Elemente im HTML in der Reihenfolge an, in der sie bedient werden.",
    code: `<!-- ohne tabindex, Reihenfolge ergibt sich aus dem HTML -->
<input id="name" name="name" autocomplete="name">`,
  },
  "outline-inline": {
    crit: "2.4.7",
    sev: "hoch",
    title: "Fokusrahmen im style-Attribut entfernt",
    explain:
      "outline: none im style-Attribut entfernt den Fokusrahmen dieses Elements, und ein Inline-Stil lässt sich aus dem Stylesheet kaum überschreiben. Wer mit der Tastatur arbeitet, sieht dann nicht, wo er gerade ist, außer es gibt einen anderen deutlichen Fokus-Effekt.",
    fix: "Entfernen Sie outline aus dem style-Attribut und gestalten Sie den Fokus im Stylesheet mit :focus-visible.",
    code: FOCUS_CSS,
  },
  "outline-css": {
    crit: "2.4.7",
    sev: "hinweis",
    title: "Fokusrahmen per CSS entfernt, ohne Ersatz in derselben Regel",
    explain:
      "Eine CSS-Regel im HTML der Seite entfernt den Fokusrahmen (outline) für den Fokus-Zustand und setzt in derselben Regel keinen anderen Fokus-Effekt. Vielleicht steht der Ersatz an anderer Stelle. Prüfen Sie mit der Tab-Taste, ob der Fokus überall gut sichtbar ist.",
    fix: "Ersetzen Sie den entfernten Rahmen durch einen deutlichen Fokus-Stil.",
    code: FOCUS_CSS,
  },
  "meta-refresh": {
    crit: "2.2.1",
    sev: "hoch",
    title: "Seite lädt sich automatisch neu oder leitet weiter",
    explain:
      "Ein meta refresh lädt die Seite nach einer festen Zeit neu oder leitet weiter. Wer langsam liest oder gerade ein Formular ausfüllt, verliert Zeit oder Eingaben und kann das nicht verhindern.",
    fix: "Entfernen Sie das automatische Neuladen. Weiterleitungen richten Sie auf dem Server ein (HTTP 301) oder ohne Wartezeit.",
    code: `<!-- entfernen -->
<meta http-equiv="refresh" content="300">`,
  },
  "viewport-zoom": {
    crit: "1.4.4",
    sev: "mittel",
    title: "Vergrößern auf dem Handy gesperrt",
    explain:
      "Die viewport-Angabe verbietet das Zoomen (user-scalable=no oder maximum-scale unter 2). Manche Browser halten sich daran. Menschen mit Sehbehinderung können das Formular dann nicht vergrößern.",
    fix: "Lassen Sie das Zoomen zu.",
    code: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  },
  "timeout-text": {
    crit: "2.2.1",
    sev: "hinweis",
    title: "Hinweis auf ein Zeitlimit gefunden",
    explain:
      "Im Text der Seite steht etwas, das nach einem Zeitlimit klingt. Läuft eine Sitzung ab, muss man sie verlängern können: mit Warnung vorher und mindestens 20 Sekunden Zeit für eine einfache Aktion. Ob das so ist, zeigt sich erst beim Ausfüllen.",
    fix: "Verzichten Sie bei Formularen möglichst auf Zeitlimits. Sonst warnen Sie rechtzeitig und bieten „Sitzung verlängern“ an.",
  },
  "onchange-context": {
    crit: "3.2.2",
    sev: "mittel",
    title: "Auswahl löst sofort Absenden oder Seitenwechsel aus",
    explain:
      "Das Feld schickt das Formular ab oder wechselt die Seite, sobald sich die Auswahl ändert (onchange). Wer mit den Pfeiltasten durch eine Auswahlliste blättert, landet dann ungewollt auf einer anderen Seite.",
    fix: "Lösen Sie die Aktion erst mit einem eigenen Schalter aus.",
    code: `<select id="sprache" name="sprache">…</select>
<button type="submit">Sprache wechseln</button>`,
  },
  "fake-button": {
    crit: "2.1.1",
    sev: "kritisch",
    title: "Klickbares Element nicht per Tastatur erreichbar",
    explain:
      "Das Element hat eine Klickfunktion (onclick oder role=\"button\"), ist aber kein echter Schalter und nicht mit der Tab-Taste erreichbar. Wer keine Maus benutzt, kann es nicht auslösen.",
    fix: "Nehmen Sie ein button-Element. Es ist von Haus aus per Tastatur bedienbar und wird als Schalter angesagt.",
    code: `<!-- statt -->
<div class="submit" onclick="senden()">Bestellen</div>
<!-- besser -->
<button type="submit">Bestellen</button>`,
  },
  "fake-submit": {
    crit: "4.1.2",
    sev: "hoch",
    title: "Absende-Knopf vermutlich kein echter Schalter",
    explain:
      "Das Formular hat keinen Schalter zum Absenden (button oder input type=\"submit\"). Dafür gibt es ein Element, das nach Knopf benannt ist. Macht JavaScript es klickbar, fehlen ihm trotzdem die Rolle „Schalter“ und die Bedienung per Tastatur.",
    fix: "Nehmen Sie ein button-Element mit type=\"submit\".",
    code: `<button type="submit">Bestellen</button>`,
  },
  "no-submit": {
    crit: "2.1.1",
    sev: "hinweis",
    title: "Kein Absende-Schalter im HTML",
    explain:
      "Im Formular ist kein Schalter zum Absenden zu finden. Vielleicht entsteht er erst per JavaScript. Prüfen Sie, ob sich das Formular mit der Tastatur absenden lässt.",
    fix: "Verwenden Sie einen echten Schalter zum Absenden.",
    code: `<button type="submit">Absenden</button>`,
  },
  "aria-hidden-focus": {
    crit: "4.1.2",
    sev: "hinweis",
    title: "Eingabefeld für Screenreader versteckt",
    explain:
      "Das Feld steckt in einem Bereich mit aria-hidden=\"true\" und hat keinen tabindex=\"-1\". Ist der Bereich sichtbar oder nur optisch versteckt, erreichen Tastaturnutzer das Feld, Screenreader sagen es aber nicht an. Bei versteckten Spamschutz-Feldern füllen manche es aus und werden als Spam abgewiesen. Blendet CSS den ganzen Bereich aus, etwa einen geschlossenen Dialog, ist alles in Ordnung.",
    fix: "Entfernen Sie aria-hidden, oder nehmen Sie das Element mit tabindex=\"-1\" oder hidden ganz aus der Bedienung.",
    code: `<div aria-hidden="true" class="hp">
  <input name="website" tabindex="-1" autocomplete="off">
</div>`,
  },
  "iframe-no-title": {
    crit: "4.1.2",
    sev: "mittel",
    title: "Eingebetteter Rahmen ohne Titel",
    explain:
      "Der iframe hat kein title-Attribut. Screenreader sagen nur „Rahmen“ an. Steckt darin ein Formular, wissen Nutzer nicht, was sie erwartet.",
    fix: "Geben Sie dem iframe einen title, der den Inhalt nennt.",
    code: `<iframe src="…" title="Kontaktformular"></iframe>`,
  },
  "invalid-no-message": {
    crit: "3.3.1",
    sev: "mittel",
    title: "Feld als fehlerhaft markiert, ohne verknüpfte Meldung",
    explain:
      "Das Feld trägt aria-invalid=\"true\", aber keine Fehlermeldung ist über aria-describedby oder aria-errormessage verbunden. Ein Screenreader sagt „ungültig“, aber nicht, was falsch ist.",
    fix: "Verbinden Sie die Fehlermeldung mit dem Feld.",
    code: `<input id="email" type="email" aria-invalid="true" aria-describedby="email-fehler">
<p id="email-fehler">Die E-Mail-Adresse braucht ein @, zum Beispiel name@example.org.</p>`,
  },
  "error-unlinked": {
    crit: "3.3.1",
    sev: "hinweis",
    title: "Fehlermeldung nicht mit dem Feld verbunden",
    explain:
      "Im HTML steht eine Fehlermeldung, vielleicht noch per CSS versteckt. Sie ist weder über aria-describedby mit einem Feld verbunden noch als Live-Region angelegt. Verbindet auch das JavaScript sie nicht, hört sie niemand, der mit Screenreader von Feld zu Feld springt. Prüfen Sie das nach einem fehlerhaften Absenden.",
    fix: "Verbinden Sie die Meldung mit aria-describedby und markieren Sie das Feld mit aria-invalid=\"true\".",
    code: `<input id="plz" aria-invalid="true" aria-describedby="plz-fehler">
<p id="plz-fehler">Bitte fünf Ziffern eingeben.</p>`,
  },
  "no-live-region": {
    crit: "4.1.3",
    sev: "hinweis",
    title: "Keine Live-Region für Meldungen erkennbar",
    explain:
      "Im HTML gibt es keinen Bereich mit role=\"alert\", role=\"status\" oder aria-live. Meldungen wie „3 Fehler gefunden“ oder „Danke, Ihre Nachricht ist angekommen“ werden dann womöglich nicht angesagt. Oft legt JavaScript solche Bereiche erst an, oder die Seite lädt nach dem Absenden neu, was auch funktioniert. Prüfen Sie es mit einem Screenreader.",
    fix: "Legen Sie einen Statusbereich schon im HTML an und schreiben Sie Meldungen hinein.",
    code: `<div role="status" id="formular-status"></div>`,
  },
  "lang-missing": {
    crit: "3.1.1",
    sev: "hoch",
    title: "Sprache der Seite fehlt",
    explain:
      "Ohne lang-Attribut weiß der Screenreader nicht, in welcher Sprache er vorlesen soll, und spricht deutschen Text womöglich mit englischer Aussprache. Auch Übersetzungshilfen und Silbentrennung brauchen die Angabe.",
    fix: "Setzen Sie die Sprache am html-Element.",
    code: `<html lang="de">`,
  },
  "lang-invalid": {
    crit: "3.1.1",
    sev: "mittel",
    title: "Sprachangabe hat kein gültiges Format",
    explain:
      "Der Wert im lang-Attribut entspricht nicht dem üblichen Sprachcode (BCP 47), etwa „de“ oder „de-DE“. Hilfsmittel erkennen die Sprache dann womöglich nicht.",
    fix: "Verwenden Sie einen gültigen Sprachcode mit Bindestrich statt Unterstrich.",
    code: `<html lang="de-DE">`,
  },
  "title-missing": {
    crit: "2.4.2",
    sev: "mittel",
    title: "Seite ohne Titel",
    explain:
      "Der Seitentitel ist das Erste, was ein Screenreader ansagt, und er steht im Browser-Tab. Ohne ihn ist bei mehreren offenen Tabs unklar, welche Seite welche ist.",
    fix: "Geben Sie der Seite einen Titel, der ihren Zweck nennt.",
    code: `<title>Kontaktformular · Verein Musterstadt</title>`,
  },
  "heading-empty": {
    crit: "2.4.6",
    sev: "mittel",
    title: "Leere Überschrift",
    explain:
      "Die Überschrift enthält keinen Text. Screenreader kündigen eine Überschrift an und sagen dann nichts. Das stört die Orientierung über die Überschriftenliste.",
    fix: "Füllen Sie die Überschrift mit Text oder entfernen Sie das leere Element.",
    code: `<h2>Ihre Kontaktdaten</h2>`,
  },
  "headings-none": {
    crit: "empfehlung",
    sev: "hinweis",
    title: "Keine Überschriften auf der Seite",
    explain:
      "Die Seite hat keine einzige Überschrift. Viele Screenreader-Nutzer springen über Überschriften durch eine Seite. Ohne sie müssen sie alles der Reihe nach anhören. WCAG verlangt Überschriften nicht zwingend, das W3C empfiehlt sie aber für jede Seite.",
    fix: "Gliedern Sie die Seite mit h1 bis h6.",
    code: `<h1>Kontakt</h1>
<h2>Schreiben Sie uns</h2>`,
    ref: { label: "W3C-Tutorial: Headings", url: "https://www.w3.org/WAI/tutorials/page-structure/headings/" },
  },
  "heading-no-h1": {
    crit: "empfehlung",
    sev: "hinweis",
    title: "Keine Hauptüberschrift (h1)",
    explain:
      "Die Seite hat Überschriften, aber keine h1. Viele Screenreader-Nutzer springen zuerst zur Hauptüberschrift, um zu erfahren, worum es geht. Ein Verstoß gegen ein WCAG-Kriterium ist das allein nicht.",
    fix: "Zeichnen Sie den sichtbaren Seitentitel als h1 aus.",
    code: `<h1>Mitgliedsantrag</h1>`,
    ref: { label: "W3C-Tutorial: Headings", url: "https://www.w3.org/WAI/tutorials/page-structure/headings/" },
  },
  "heading-skip": {
    crit: "empfehlung",
    sev: "hinweis",
    title: "Überschriftenebenen übersprungen",
    explain:
      "Auf eine Überschrift folgt eine, die mehr als eine Ebene tiefer liegt, etwa h2 direkt auf h4. Wer per Überschriftenliste navigiert, vermutet dann einen fehlenden Abschnitt. Ein WCAG-Verstoß ist das allein nicht; das W3C empfiehlt, keine Ebenen zu überspringen.",
    fix: "Vergeben Sie die Ebenen der Reihe nach. Die Größe regeln Sie per CSS.",
    code: `<h2>Ihre Angaben</h2>
<h3>Anschrift</h3>`,
    ref: { label: "W3C-Tutorial: Headings", url: "https://www.w3.org/WAI/tutorials/page-structure/headings/" },
  },
} satisfies Record<string, RuleDef>

export type RuleId = keyof typeof RULES
