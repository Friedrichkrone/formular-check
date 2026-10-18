// Statische Prüfung eines HTML-Dokuments auf Barrieren in Formularen.
//
// Das HTML wird in ein eigenes Dokument geladen (im Browser mit DOMParser, in Node mit jsdom).
// Dabei werden keine Skripte ausgeführt und keine Bilder, Stylesheets oder Rahmen geladen. Weil
// weder CSS noch Layout noch JavaScript wirken, prüft dieser Code nur, was im Quelltext sicher zu
// erkennen ist, und kennzeichnet Unsicheres als Hinweis.

import { CRITERIA, critSort, type CritId, type CritRef } from "./criteria.js"
import { cssEscape } from "./css-escape.js"
import { RULES, SEVERITIES, type RuleId, type Severity } from "./rules.js"

export interface FindingItem {
  snippet: string
  note?: string
  context?: string
}

export interface Finding {
  id: RuleId
  crit: CritRef
  sev: Severity
  title: string
  explain: string
  fix: string
  code?: string
  ref?: { label: string; url: string }
  items: FindingItem[]
}

export interface FormSummary {
  index: number
  label: string
  fields: number
  kind: "formular" | "suche" | "anmeldung"
}

export interface CritStatus {
  id: CritId
  state: "ok" | "befund" | "hinweis"
}

export interface AnalyzeOptions {
  /** Bezeichnung der Quelle im Bericht, etwa ein Dateiname oder eine Adresse */
  label?: string
  /**
   * Ausschnitt ohne html-Element: Sprache, Seitentitel und Überschriftenstruktur werden nicht
   * geprüft. Bei Text wird das automatisch erkannt, bei einem Document gilt false.
   */
  fragment?: boolean
  /** HTML-Parser für Text; ohne Angabe globalThis.DOMParser (Browser) */
  parse?: (html: string) => Document
}

export interface Report {
  /** "html": Text wurde geparst, "document": ein fertiges Document wurde übergeben */
  source: "html" | "document"
  label?: string
  checkedAt: string
  title: string
  lang: string
  fragment: boolean
  forms: FormSummary[]
  fields: number
  fieldsOutside: number
  findings: Finding[]
  counts: Record<Severity, number>
  places: number
  criteria: CritStatus[]
  patterns: { describedby: number; invalid: number; required: number; live: number }
  notes: string[]
  skipped: { hidden: number; honeypot: number }
}

// ------------------------------------------------------------------ Grundlagen

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim()
const tag = (el: Element) => el.localName.toLowerCase()
const LETTER = /[0-9A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-ۿ぀-ヿ一-鿿]/
// Emoji werden von Screenreadern mit Namen vorgelesen und gelten deshalb als Text.
const EMOJI = /[\uD83C-\uD83E][\uDC00-\uDFFF]|[☀-➿]/
const meaningful = (s: string) => LETTER.test(s) || EMOJI.test(s)
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/[^0-9a-zÀ-ɏЀ-ӿ]+/g, " ")
    .split(" ")
    .filter((w) => w && w !== "und" && w !== "and")
    .join(" ")
const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
// getAttribute statt el.className/el.id: Formularfelder mit name="id" überdecken sonst form.id.
const classOf = (el: Element) => el.getAttribute("class") ?? ""
const idOf = (el: Element) => el.getAttribute("id") ?? ""
const styleOf = (el: Element) => (el.getAttribute("style") ?? "").toLowerCase().replace(/\s+/g, "")

const SKIP_TEXT = new Set(["script", "style", "template", "noscript", "head", "title", "meta", "link"])
const INLINE = new Set(["span", "b", "strong", "em", "i", "u", "s", "small", "mark", "abbr", "sup", "sub", "wbr", "code", "kbd", "q", "cite", "dfn", "time", "data", "bdi", "bdo", "font"])
const ICON_CLASS = /(^|[\s_-])(material-(symbols|icons)[\w-]*|icon|icons|glyphicon|fa|fas|far|fab|fa-[\w-]+|bi|bi-[\w-]+|ti|ti-[\w-]+|ion-[\w-]+|dashicons[\w-]*)([\s_-]|$)/i
const LABELABLE = "button, input:not([type=hidden]), meter, output, progress, select, textarea"
const SR_ONLY =
  /(^|\s)(sr-only|visually-hidden|visuallyhidden|visually_hidden|is-visually-hidden|u-visually-hidden|screen-reader-text|screen-reader-only|screenreader-only|sr_only|element-invisible|offscreen|a11y-hidden|hidden-visually|elementor-screen-only|show-for-sr|assistive-text|hide-text|text-hide|visuallyHidden)(\s|$)/i
const COOKIE =
  "[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i],[id*=borlabs i],[class*=borlabs i],[id*=usercentrics i],[id*=onetrust i],[class*=klaro i],[id*=cmplz i],[class*=cmplz i],[id*=gdpr i],[class*=gdpr i]"

function selfHidden(el: Element): boolean {
  if (el.hasAttribute("hidden")) return true
  const t = tag(el)
  if (t === "template" || t === "noscript") return true
  if (t === "input" && (el.getAttribute("type") ?? "").toLowerCase() === "hidden") return true
  const s = styleOf(el)
  return /display:none/.test(s) || /visibility:hidden/.test(s)
}
function isHidden(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) if (selfHidden(n)) return true
  return false
}
function ariaHiddenUp(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) if (n.getAttribute("aria-hidden") === "true") return true
  return false
}
function offscreenStyle(el: Element): boolean {
  const s = styleOf(el)
  return (
    /(^|;)(left|top|right|margin-left|text-indent):-\d{3,}/.test(s) ||
    /clip:rect\(0/.test(s) ||
    /(^|;)opacity:0(;|$)/.test(s) ||
    (/position:(absolute|fixed)/.test(s) && /(^|;)(width|height):[01](px)?(;|$)/.test(s))
  )
}
function srOnly(el: Element, stop?: Element | null): boolean {
  for (let n: Element | null = el; n && n !== stop; n = n.parentElement) {
    if (SR_ONLY.test(classOf(n)) || offscreenStyle(n)) return true
    if (tag(n) === "form" || tag(n) === "body") break
  }
  return false
}

/** Textinhalt wie ein Screenreader ihn liest (vereinfacht); visibleOnly: wie Sehende ihn sehen. */
function textOf(node: Node, visibleOnly = false, depth = 0): string {
  if (depth > 40) return ""
  let out = ""
  node.childNodes.forEach((ch) => {
    if (ch.nodeType === 3) {
      out += (ch.nodeValue ?? "").replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
      return
    }
    if (ch.nodeType !== 1) return
    const el = ch as Element
    const t = tag(el)
    if (SKIP_TEXT.has(t) || selfHidden(el)) return
    if (visibleOnly ? SR_ONLY.test(classOf(el)) || offscreenStyle(el) : el.getAttribute("aria-hidden") === "true") return
    // Symbolschriften (Ligaturen wie „chevron_forward“) zeigen ein Zeichen, keinen Text
    if (visibleOnly && (ICON_CLASS.test(classOf(el)) || (el.getAttribute("aria-hidden") === "true" && /^[a-z0-9_]+$/.test(clean(el.textContent))))) return
    if (t === "img" || t === "area") {
      out += ` ${visibleOnly ? "" : clean(el.getAttribute("aria-label")) || el.getAttribute("alt") || clean(el.getAttribute("title"))} `
      return
    }
    if (t === "svg") {
      if (!visibleOnly) out += ` ${svgName(el)} `
      return
    }
    if (t === "input" || t === "select" || t === "textarea") return
    const al = clean(el.getAttribute("aria-label"))
    if (al && !visibleOnly && t !== "label") {
      out += ` ${al} `
      return
    }
    const inner = textOf(el, visibleOnly, depth + 1)
    out += INLINE.has(t) ? inner : ` ${inner} `
  })
  return out
}

function svgName(el: Element): string {
  const al = clean(el.getAttribute("aria-label"))
  if (al) return al
  const lb = el.getAttribute("aria-labelledby")
  if (lb) {
    const t = idsText(el.ownerDocument, lb).text
    if (t) return t
  }
  const title = el.querySelector("title")
  return clean(title?.textContent)
}

function idsText(doc: Document, ids: string): { text: string; missing: string[]; found: Element[] } {
  const missing: string[] = []
  const found: Element[] = []
  const parts: string[] = []
  for (const id of ids.split(/\s+/).filter(Boolean)) {
    const e = doc.getElementById(id)
    if (!e) {
      missing.push(id)
      continue
    }
    found.push(e)
    parts.push(clean(textOf(e)) || clean(e.textContent) || clean(e.getAttribute("aria-label")))
  }
  return { text: clean(parts.join(" ")), missing, found }
}

/** Name, Text oder Wert wird per JavaScript-Framework gesetzt (Alpine, Vue, Angular, Svelte). */
const BOUND_ATTR = /^(:|x-bind:|v-bind:|\[attr\.|\[|bind:)(aria-label|aria-labelledby|title|value|placeholder|alt)\]?$|^(x-text|v-text|x-html|v-html|data-bind|ng-bind|\[innertext\]|\[textcontent\])$/i
function boundName(el: Element): boolean {
  for (const n of [el, ...Array.from(el.querySelectorAll("*")).slice(0, 20)]) {
    for (const a of Array.from(n.attributes)) if (BOUND_ATTR.test(a.name)) return true
    if (n === el && /\{\{[^}]+\}\}/.test(n.textContent ?? "")) return true
  }
  return false
}

// ------------------------------------------------------------------ Ausschnitt eines Elements

const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "area", "source", "col", "embed", "wbr"])
const BOOL_ATTR = new Set(["required", "disabled", "readonly", "checked", "multiple", "hidden", "novalidate", "autofocus", "selected"])

export function snippet(el: Element): string {
  const t = tag(el)
  const attrs: string[] = []
  for (const a of Array.from(el.attributes)) {
    if (a.name.startsWith("data-") && !/sitekey|name/.test(a.name)) continue
    if (a.name.startsWith("on") && a.value.length > 40) {
      attrs.push(`${a.name}="${a.value.slice(0, 37)}…"`)
      continue
    }
    let v = clean(a.value)
    if (v === "" && BOOL_ATTR.has(a.name)) {
      attrs.push(a.name)
      continue
    }
    if (v.length > 48) v = `${v.slice(0, 47)}…`
    attrs.push(`${a.name}="${v.replace(/"/g, "&quot;")}"`)
  }
  let open = `<${t}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`
  if (open.length > 240) open = `${open.slice(0, 238)}…>`
  if (VOID.has(t)) return open
  const txt = clean(textOf(el)) || clean(textOf(el, true))
  const inner = txt ? short(txt, 70) : el.children.length ? "…" : ""
  return `${open}${inner}</${t}>`
}

// ------------------------------------------------------------------ Namen

type NameSrc = "aria-labelledby" | "aria-label" | "label" | "title" | "placeholder" | "content" | "value" | "alt" | "default" | ""

interface NameInfo {
  name: string
  src: NameSrc
  /** sichtbarer Text der Beschriftung(en) */
  visible: string
  labels: Element[]
  labelsSrOnly: boolean
  missingRefs: string[]
}

export interface Ctx {
  doc: Document
  labelsFor: Map<string, Element[]>
}

function labelsOf(el: Element, c: Ctx): Element[] {
  const out: Element[] = []
  const wrap = el.parentElement?.closest("label")
  if (wrap && (!wrap.hasAttribute("for") || wrap.getAttribute("for") === idOf(el)) && wrap.querySelector(LABELABLE) === el) out.push(wrap)
  if (idOf(el) && c.doc.getElementById(idOf(el)) === el) for (const l of c.labelsFor.get(idOf(el)) ?? []) if (!out.includes(l)) out.push(l)
  return out
}

function fieldName(el: Element, c: Ctx): NameInfo {
  const t = tag(el)
  const role = (el.getAttribute("role") ?? "").toLowerCase()
  const native = t === "input" || t === "select" || t === "textarea"
  const labels = native || t === "button" ? labelsOf(el, c) : []
  const visible = clean(labels.map((l) => textOf(l, true)).join(" "))
  const labelsSrOnly = labels.length > 0 && labels.every((l) => srOnly(l) || !meaningful(textOf(l, true)))
  const base = { visible, labels, labelsSrOnly, missingRefs: [] as string[] }
  const lb = el.getAttribute("aria-labelledby")
  if (lb) {
    const r = idsText(c.doc, lb)
    base.missingRefs = r.missing
    if (meaningful(r.text)) return { ...base, name: r.text, src: "aria-labelledby" }
  }
  const al = clean(el.getAttribute("aria-label"))
  if (meaningful(al)) return { ...base, name: al, src: "aria-label" }
  const lt = clean(labels.map((l) => textOf(l)).join(" "))
  if (meaningful(lt)) return { ...base, name: lt, src: "label" }
  if (!native && ["checkbox", "radio", "switch", "option", "menuitemcheckbox", "menuitemradio"].includes(role)) {
    const ct = clean(textOf(el))
    if (meaningful(ct)) return { ...base, name: ct, src: "content" }
  }
  const ti = clean(el.getAttribute("title"))
  if (meaningful(ti)) return { ...base, name: ti, src: "title" }
  const ph = clean(el.getAttribute("placeholder") ?? el.getAttribute("aria-placeholder"))
  if (meaningful(ph)) return { ...base, name: ph, src: "placeholder" }
  return { ...base, name: lt || al, src: "" }
}

/**
 * Sichtbarer Text eines Schalters, nur wenn er eindeutig ist: Alle Textteile stehen im selben
 * Element. Liegen sie in verschiedenen Elementen, blendet CSS oft einen Teil aus (etwa „DE“ und
 * „Deutsch“ je nach Bildschirmbreite); dann wird nicht geurteilt.
 */
function confidentVisibleText(el: Element): string {
  const pieces: { text: string; parent: Element }[] = []
  const walk = (n: Element, depth: number) => {
    if (depth > 12) return
    n.childNodes.forEach((ch) => {
      if (ch.nodeType === 3) {
        const t = (ch.nodeValue ?? "").replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
        if (t.trim()) pieces.push({ text: t, parent: n })
        return
      }
      if (ch.nodeType !== 1) return
      const e = ch as Element
      const t = tag(e)
      if (SKIP_TEXT.has(t) || t === "svg" || selfHidden(e) || SR_ONLY.test(classOf(e)) || offscreenStyle(e)) return
      if (ICON_CLASS.test(classOf(e)) || (e.getAttribute("aria-hidden") === "true" && /^[a-z0-9_]+$/.test(clean(e.textContent)))) return
      walk(e, depth + 1)
    })
  }
  walk(el, 0)
  if (!pieces.length) return ""
  if (pieces.some((p) => p.parent !== pieces[0].parent)) return ""
  return clean(pieces.map((p) => p.text).join(""))
}

function buttonName(el: Element, c: Ctx): NameInfo & { visibleText: string } {
  const t = tag(el)
  const type = (el.getAttribute("type") ?? "").toLowerCase()
  const isInput = t === "input"
  const visibleText = isInput ? clean(el.getAttribute("value") ?? "") : confidentVisibleText(el)
  const labels = labelsOf(el, c)
  const base = { visible: visibleText, labels, labelsSrOnly: false, missingRefs: [] as string[], visibleText }
  const lb = el.getAttribute("aria-labelledby")
  if (lb) {
    const r = idsText(c.doc, lb)
    base.missingRefs = r.missing
    if (meaningful(r.text)) return { ...base, name: r.text, src: "aria-labelledby" }
  }
  const al = clean(el.getAttribute("aria-label"))
  if (al) return { ...base, name: al, src: "aria-label" }
  const lt = clean(labels.map((l) => textOf(l)).join(" "))
  if (lt) return { ...base, name: lt, src: "label" }
  if (isInput) {
    if (type === "image") {
      const alt = clean(el.getAttribute("alt"))
      if (alt) return { ...base, name: alt, src: "alt" }
    } else {
      if (el.hasAttribute("value")) {
        const v = clean(el.getAttribute("value"))
        if (v) return { ...base, name: v, src: "value" }
      } else if (type === "submit" || type === "reset") {
        return { ...base, name: type === "submit" ? "Senden" : "Zurücksetzen", src: "default" }
      }
    }
  } else {
    const ct = clean(textOf(el))
    if (ct) return { ...base, name: ct, src: "content" }
  }
  const ti = clean(el.getAttribute("title"))
  if (ti) return { ...base, name: ti, src: "title" }
  return { ...base, name: "", src: "" }
}

// ------------------------------------------------------------------ Zweck von Feldern (1.3.5)

const AUTOFILL = new Set(
  "name honorific-prefix given-name additional-name family-name honorific-suffix nickname username new-password current-password one-time-code organization-title organization street-address address-line1 address-line2 address-line3 address-level4 address-level3 address-level2 address-level1 country country-name postal-code cc-name cc-given-name cc-additional-name cc-family-name cc-number cc-exp cc-exp-month cc-exp-year cc-csc cc-type transaction-currency transaction-amount language bday bday-day bday-month bday-year sex url photo tel tel-country-code tel-national tel-area-code tel-local tel-local-prefix tel-local-suffix tel-extension email impp".split(
    " "
  )
)

interface Purpose {
  token: string
  ok: string[]
  label: RegExp
  attr: RegExp
}

const PURPOSES: Purpose[] = [
  { token: "email", ok: ["email", "username"], label: /e-?mail/, attr: /(^|[\W_])e-?mail([\W_]|$)/ },
  {
    token: "name",
    ok: ["name", "given-name", "family-name", "nickname"],
    label: /^(ihr |dein |your )?(vollständiger |voller |full )?name$|vor-? ?und (nach|zu|familien)name|name,? vorname|vorname und (nach)?name|^full name$/,
    attr: /^(name|your-?name|full-?_?name|fullname|contact-?_?name|kontakt-?_?name|ihr-?name)$/,
  },
  { token: "given-name", ok: ["given-name", "name"], label: /vorname|first ?name|given ?name/, attr: /first.?name|vorname|given.?name|(^|[\W_])fname([\W_]|$)/ },
  { token: "family-name", ok: ["family-name", "name"], label: /nachname|familienname|last ?name|surname|family ?name|zuname/, attr: /last.?name|nachname|surname|family.?name|(^|[\W_])lname([\W_]|$)/ },
  {
    token: "organization",
    ok: ["organization", "organization-title"],
    label: /^(firma|unternehmen|firmenname|organisation|organization|company|company name|unternehmensname)$/,
    attr: /^(company|firma|organisation|organization|unternehmen|firmenname|company.?name|your-?company)$/,
  },
  { token: "tel", ok: ["tel", "tel-national", "tel-local"], label: /telefon|phone|handy|mobilnummer|mobiltelefon|rufnummer|^tel\.?$|festnetz/, attr: /(^|[\W_])(tel|phone|telefon|mobile|handy|telephone|telefonnummer)([\W_]|$)/ },
  {
    token: "street-address",
    ok: ["street-address", "address-line1", "address-line2", "address-line3"],
    // „Hausnummer“ allein hat keinen eigenen Eingabezweck in WCAG 1.3.5
    label: /straße|strasse|anschrift|street|^adresse$|^address$|adresszeile/,
    attr: /(^|[\W_])(street|strasse|straße|address|adresse|anschrift|address.?line.?1)([\W_]|$)/,
  },
  { token: "postal-code", ok: ["postal-code"], label: /(^|\W)plz(\W|$)|postleitzahl|zip|postal|postcode|post code/, attr: /(^|[\W_])(plz|zip|zipcode|postal.?code|postcode|postleitzahl)([\W_]|$)/ },
  { token: "address-level2", ok: ["address-level2"], label: /^(ort|wohnort|stadt|city|town|ortschaft)$/, attr: /^(ort|city|town|stadt|wohnort|locality)$/ },
  { token: "country", ok: ["country", "country-name"], label: /^(land|country|staat|land\/region)$/, attr: /^(country|land)$/ },
  { token: "bday", ok: ["bday", "bday-day", "bday-month", "bday-year"], label: /geburtsdatum|geburtstag|date of birth|birthday|birth date/, attr: /(birth|geburt|bday|(^|[\W_])dob([\W_]|$))/ },
]

const NOT_SELF = /empfänger|recipient|freund|friend|des kindes|kind|partner|begünstigt|veranstaltung|der |des |geburtsort|firma |unternehmen |verein|schule|einrichtung|produkt|projekt|benutzer|datei|bank|konto|fax|^e-?mail-?adresse des|ansprechpartner(in)? (des|der)/

function stripLabel(s: string) {
  return clean(
    s
      .toLowerCase()
      .replace(/\*/g, " ")
      .replace(/\((pflicht\w*|erforderlich|required|optional|freiwillig)\)/g, " ")
      .replace(/\b(pflichtfeld|erforderlich|required)\b/g, " ")
      .replace(/[:?]/g, " ")
  )
}

function purposeOf(el: Element, label: string, auth: boolean): Purpose | { token: "username" | "password"; ok: string[] } | null {
  const t = tag(el)
  const type = (el.getAttribute("type") ?? "text").toLowerCase()
  if (t === "input" && !["text", "email", "tel", "number", "date", "password", "url", ""].includes(type)) return null
  if (type === "password") return { token: "password", ok: ["current-password", "new-password"] }
  const l = stripLabel(label)
  const attrs = `${el.getAttribute("name") ?? ""} ${idOf(el)}`.toLowerCase()
  const exact = [(el.getAttribute("name") ?? "").toLowerCase(), idOf(el).toLowerCase()]
  if (auth && type !== "email" && (/benutzername|username|anmeldename|nutzername|kennung|login/.test(l) || /(user.?name|login|benutzer)/.test(attrs))) return { token: "username", ok: ["username", "email"] }
  if (NOT_SELF.test(l)) return null
  if (/(^|\W)(plz|postleitzahl)(\W|$)/.test(l) && /(^|\W)(ort|stadt|city)(\W|$)/.test(l)) return null // kombiniertes Feld
  if (type === "email") return PURPOSES[0]
  if (type === "tel") return PURPOSES.find((p) => p.token === "tel")!
  for (const p of PURPOSES) {
    if (l && p.label.test(l)) return p
    if (p.attr.source.startsWith("^") ? exact.some((x) => p.attr.test(x)) : p.attr.test(attrs)) {
      // Attribute nur nutzen, wenn die Beschriftung nicht etwas anderes sagt
      if (!l || l.length < 3) return p
    }
  }
  return null
}

// ------------------------------------------------------------------ Hauptprüfung

const FIELD_SEL =
  "input, select, textarea, [role=textbox], [role=combobox], [role=searchbox], [role=spinbutton], [role=slider], [role=checkbox], [role=radio], [role=switch], [role=listbox]"
const BUTTON_TYPES = ["submit", "reset", "button", "image"]
const HONEYPOT =
  /(^|[\W_])(hp|honeypot|honey|hpot|gotcha|_gotcha|trap|botcheck|bot-?field|leave[\W_]?(this[\W_]?)?(blank|empty)|do[\W_]?not[\W_]?fill|nicht[\W_]?ausf\w*|ohnec|spamcheck|ak_hp|wpforms-field-hp|gform_validation_container|cf7-hp|nospam|no-spam|fax_only|hidden-field|url_hp|website_hp|mail_hp)([\W_]|$)/i
const ERR_CLASS =
  /(^|[\s_-])(error|errors|fehler|fehlermeldung|invalid-feedback|form-error|field-error|error-message|errormessage|validation-error|validation-message|not-valid-tip|errortext|error-text|parsley-errors-list)([\s_-]|$)/i
const QUIZ = /\d+\s*(\+|-|−|plus|minus|x|×|\*|mal|geteilt durch)\s*\d+|rechenaufgabe|ergebnis der (rechnung|aufgabe)|sicherheitsfrage|bitte rechnen|summe (von|aus)|wie viel ist|was ergibt|spamschutz-?frage|anti-?spam-?frage|quiz/i
const CAPTCHA_NAME = /captcha|securimage|sicherheitscode|spamschutz/i
const TIMEOUT_TEXT =
  /ihre sitzung (läuft|endet|wird beendet|ist abgelaufen)|sitzung (läuft|endet) in|sitzung verlängern|sitzung ist abgelaufen|(automatisch|aus sicherheitsgründen) abgemeldet|your session (will )?(expire|time)|session (has )?expired|session timeout|verbleibende (bearbeitungs)?zeit|zeitlimit|time limit|countdown/i
const PROVIDERS: [RegExp, string][] = [
  [/hsforms\.(net|com)|hubspot/i, "HubSpot"],
  [/typeform\.com/i, "Typeform"],
  [/jotform/i, "Jotform"],
  [/docs\.google\.com\/forms|forms\.gle/i, "Google Forms"],
  [/forms\.office\.com|forms\.microsoft\.com/i, "Microsoft Forms"],
  [/cognitoforms/i, "Cognito Forms"],
  [/formstack/i, "Formstack"],
  [/tally\.so/i, "Tally"],
  [/paperform/i, "Paperform"],
  [/123formbuilder|123contactform/i, "123FormBuilder"],
  [/wufoo/i, "Wufoo"],
  [/formular-server|form-solutions|formsolutions/i, "Form-Solutions"],
  [/mailchimp|list-manage\.com/i, "Mailchimp"],
  [/brevo|sendinblue|sibforms/i, "Brevo"],
  [/calendly/i, "Calendly"],
  [/zohopublic|forms\.zoho/i, "Zoho Forms"],
  [/survey ?monkey/i, "SurveyMonkey"],
  [/limesurvey/i, "LimeSurvey"],
]

const focusableSel =
  'a[href], button, input:not([type=hidden]), select, textarea, summary, iframe, [tabindex], [contenteditable=""], [contenteditable=true]'

function defaultParse(html: string): Document {
  const P = (globalThis as { DOMParser?: new () => DOMParser }).DOMParser
  if (!P) throw new Error("Kein HTML-Parser verfügbar. In Node.js nutzen Sie den Einstieg \"@schwerpunkt/formular-check/node\" oder übergeben die Option parse.")
  return new P().parseFromString(html, "text/html")
}

/** HTML-Text prüfen. Im Browser ohne weitere Angaben; in Node.js über den Einstieg ./node oder mit opts.parse. */
export function analyzeHtml(html: string, opts: AnalyzeOptions = {}): Report {
  const doc = (opts.parse ?? defaultParse)(html)
  return run(doc, "html", { ...opts, fragment: opts.fragment ?? !/<html[\s>]/i.test(html) })
}

/** Ein bereits geladenes Document prüfen (etwa aus jsdom, einem iframe oder document selbst). */
export function analyzeDocument(doc: Document, opts: AnalyzeOptions = {}): Report {
  return run(doc, "document", opts)
}

/** Text oder Document prüfen */
export function analyze(input: string | Document, opts: AnalyzeOptions = {}): Report {
  return typeof input === "string" ? analyzeHtml(input, opts) : analyzeDocument(input, opts)
}

function run(doc: Document, source: Report["source"], opts: AnalyzeOptions): Report {
  const fragment = !!opts.fragment
  const body = doc.body ?? doc.documentElement

  const labelsFor = new Map<string, Element[]>()
  doc.querySelectorAll("label[for]").forEach((l) => {
    const f = l.getAttribute("for") ?? ""
    if (!labelsFor.has(f)) labelsFor.set(f, [])
    labelsFor.get(f)!.push(l)
  })
  const c: Ctx = { doc, labelsFor }

  const found = new Map<RuleId, FindingItem[]>()
  const touched = new Set<CritId>()
  const touch = (...ids: CritId[]) => ids.forEach((i) => touched.add(i))
  const notes: string[] = []
  const seen = new Map<RuleId, Set<Element | string>>()
  const add = (id: RuleId, el: Element | null, note?: string, context?: string) => {
    const list = found.get(id) ?? []
    const keys = seen.get(id) ?? new Set<Element | string>()
    const key = el ?? note ?? ""
    if (keys.has(key) || list.length >= 60) return
    keys.add(key)
    seen.set(id, keys)
    list.push({ snippet: el ? snippet(el) : "", note, context })
    found.set(id, list)
  }

  // Formulare
  const formEls = Array.from(doc.querySelectorAll("form"))
  const formOf = (el: Element): HTMLFormElement | null => {
    const fa = el.getAttribute("form")
    if (fa) {
      const f = doc.getElementById(fa)
      if (f && tag(f) === "form") return f as HTMLFormElement
    }
    return el.closest("form")
  }
  const isAuthForm = (f: Element) =>
    !!f.querySelector('input[type=password i], input[autocomplete~="current-password" i], input[autocomplete~="one-time-code" i]')
  const formLabel = (f: Element): string => {
    const al = clean(f.getAttribute("aria-label"))
    if (al) return short(al, 40)
    const lb = f.getAttribute("aria-labelledby")
    if (lb) {
      const t = idsText(doc, lb).text
      if (t) return short(t, 40)
    }
    if (f.getAttribute("role") === "search" || f.closest("[role=search]") || f.querySelector("input[type=search i]")) return "Suche"
    if (isAuthForm(f)) return "Anmeldung"
    const h = f.querySelector("h1, h2, h3, h4, legend")
    if (h && meaningful(textOf(h))) return short(clean(textOf(h)), 40)
    const idn = f.getAttribute("name") || idOf(f)
    return idn ? short(idn, 40) : ""
  }
  const formLabels = formEls.map(formLabel)
  const contextOf = (el: Element): string => {
    const f = formOf(el)
    if (f) {
      const i = formEls.indexOf(f as HTMLFormElement)
      return `Formular ${i + 1}${formLabels[i] ? ` („${formLabels[i]}“)` : ""}`
    }
    const ck = el.closest(COOKIE)
    if (ck && !["body", "html", "main"].includes(tag(ck))) return "Cookie-Hinweis"
    if (el.closest("header, [role=banner]")) return "Kopfbereich, außerhalb eines Formulars"
    if (el.closest("footer, [role=contentinfo]")) return "Fußbereich, außerhalb eines Formulars"
    if (el.closest("nav, [role=navigation]")) return "Navigation"
    return "außerhalb eines Formulars"
  }
  const pageHasPassword = !!doc.querySelector("input[type=password i]")

  // ---------------------------------------------------------------- Dokument
  const lang = clean(doc.documentElement.getAttribute("lang") ?? doc.documentElement.getAttribute("xml:lang"))
  const title = clean(doc.title)
  if (!fragment) {
    touch("3.1.1", "2.4.2")
    if (!lang) add("lang-missing", null, "Kein lang-Attribut am <html>-Element")
    else if (!/^[a-z]{2,3}(-[a-z0-9]{1,8})*$/i.test(lang)) add("lang-invalid", null, `lang="${short(lang, 30)}"`)
    if (!title) add("title-missing", null, "Kein oder ein leeres <title>-Element")
  }
  touch("2.2.1")
  doc.querySelectorAll("meta[http-equiv]").forEach((m) => {
    if ((m.getAttribute("http-equiv") ?? "").toLowerCase() !== "refresh") return
    const content = m.getAttribute("content") ?? ""
    const sec = parseFloat(content)
    if (!(sec > 0) || sec >= 72000) return
    const redirect = /url\s*=/i.test(content)
    add("meta-refresh", m, redirect ? `Weiterleitung nach ${sec} Sekunden` : `Neu laden alle ${sec} Sekunden`)
  })
  const vp = doc.querySelector("meta[name=viewport i]")
  if (vp) {
    touch("1.4.4")
    const v = (vp.getAttribute("content") ?? "").toLowerCase().replace(/\s+/g, "")
    const ms = /maximum-scale=([\d.]+)/.exec(v)
    if (/user-scalable=(no|0)(,|;|$)/.test(v)) add("viewport-zoom", vp, "user-scalable=no")
    else if (ms && parseFloat(ms[1]) < 2) add("viewport-zoom", vp, `maximum-scale=${ms[1]}`)
  }

  // Zeitlimit-Hinweise im sichtbaren Text (ohne Cookie-Hinweise und Fußbereich)
  {
    const clone = body.cloneNode(true) as Element
    clone.querySelectorAll("script, style, template, noscript, footer").forEach((e) => e.remove())
    clone.querySelectorAll(COOKIE).forEach((e) => {
      if (!e.querySelector("form, main") && (e.textContent ?? "").length < 8000) e.remove()
    })
    const txt = clean(clone.textContent)
    const m = TIMEOUT_TEXT.exec(txt)
    if (m) {
      const at = m.index
      add("timeout-text", null, `„…${clean(txt.slice(Math.max(0, at - 30), at + m[0].length + 30))}…“`)
    }
    if (doc.querySelector("[role=timer]")) add("timeout-text", doc.querySelector("[role=timer]"), "Element mit role=\"timer\"")
  }

  // ---------------------------------------------------------------- Felder
  const fieldSet = new Set<Element>()
  doc.querySelectorAll(FIELD_SEL).forEach((el) => {
    const t = tag(el)
    if (t === "input" && BUTTON_TYPES.includes((el.getAttribute("type") ?? "").toLowerCase())) return
    if (t === "input" && (el.getAttribute("type") ?? "").toLowerCase() === "hidden") return
    if (el.closest("svg")) return
    // Elemente mit Feld-Rolle, in denen ein echtes Feld steckt, nicht doppelt zählen
    if (t !== "input" && t !== "select" && t !== "textarea" && el.querySelector("input:not([type=hidden]), select, textarea")) return
    fieldSet.add(el)
  })

  let hiddenCount = 0
  let honeypotCount = 0
  let ariaHiddenCount = 0
  interface Field {
    el: Element
    form: HTMLFormElement | null
    type: string
    n: NameInfo
    auth: boolean
    search: boolean
  }
  const fields: Field[] = []
  for (const el of fieldSet) {
    if (isHidden(el)) {
      hiddenCount++
      continue
    }
    const form = formOf(el)
    const type = tag(el) === "input" ? (el.getAttribute("type") ?? "text").toLowerCase() : tag(el) === "select" || tag(el) === "textarea" ? tag(el) : `role=${el.getAttribute("role")}`
    const n = fieldName(el, c)
    // Spamschutz-Fallen (Honigtopf-Felder) sind für Menschen nicht gedacht
    const idents: string[] = []
    for (let p: Element | null = el, i = 0; p && i < 4 && tag(p) !== "form"; p = p.parentElement, i++) idents.push(`${idOf(p)} ${classOf(p)} ${p.getAttribute("name") ?? ""} ${p.getAttribute("data-name") ?? ""}`)
    let offscreenUp = false
    for (let p: Element | null = el; p && tag(p) !== "form" && tag(p) !== "body"; p = p.parentElement) if (offscreenStyle(p)) offscreenUp = true
    const ti = el.getAttribute("tabindex")
    // Optisch versteckte Kontrollkästchen und Optionsfelder sind oft eigene Gestaltungen mit
    // sichtbarem label; die werden geprüft. Versteckte Textfelder gelten als Falle.
    const honeypot =
      idents.some((s) => HONEYPOT.test(s)) ||
      (offscreenUp && type !== "checkbox" && type !== "radio") ||
      (ariaHiddenUp(el) && ti === "-1") ||
      (ti === "-1" && !meaningful(n.name) && ["text", "email", "url", "tel"].includes(type))
    if (honeypot) {
      honeypotCount++
      continue
    }
    // Für Screenreader ausgeblendete Felder (aria-hidden) haben keine Ansage; Namen und Zweck
    // werden nicht bewertet. Ob sie per Tab erreichbar sind, prüft die Regel aria-hidden-focus.
    if (ariaHiddenUp(el)) {
      ariaHiddenCount++
      continue
    }
    const search =
      type === "search" ||
      el.getAttribute("role") === "searchbox" ||
      !!el.closest("[role=search]") ||
      /(^|[\W_])(q|s|search|query|suche|sword|searchword|keywords?|term|searchterm|suchbegriff|suchwort)([\W_]|$)/i.test(el.getAttribute("name") ?? "") ||
      /(^|[\W_])(search|suche)/i.test(`${idOf(el)} ${classOf(el)} ${form?.getAttribute("action") ?? ""} ${form ? `${classOf(form)} ${idOf(form)}` : ""} ${form?.getAttribute("role") ?? ""}`)
    fields.push({ el, form, type, n, auth: form ? isAuthForm(form) : pageHasPassword, search })
  }

  if (fields.length) touch("4.1.2", "3.3.2", "1.3.1", "3.3.1")
  let boundCount = 0

  // Zählung: Optionsgruppen zählen einmal
  const radioKeys = new Set<string>()
  let fieldCount = 0
  let outside = 0
  const perForm = new Map<HTMLFormElement, number>()
  for (const f of fields) {
    if (f.type === "radio") {
      const key = `${f.form ? formEls.indexOf(f.form) : -1}|${f.el.getAttribute("name") ?? Math.random()}`
      if (radioKeys.has(key)) continue
      radioKeys.add(key)
    }
    fieldCount++
    if (f.form) perForm.set(f.form, (perForm.get(f.form) ?? 0) + 1)
    else outside++
  }

  for (const f of fields) {
    const { el, n, type } = f
    const ctx = contextOf(el)
    const kind = type === "radio" ? "Optionsfeld" : type === "checkbox" ? "Kontrollkästchen" : type === "select" ? "Auswahlliste" : type === "textarea" ? "Textfeld" : "Feld"
    const ident = el.getAttribute("name") ? `name="${short(el.getAttribute("name")!, 30)}"` : idOf(el) ? `id="${short(idOf(el), 30)}"` : `type="${type}"`

    if (!meaningful(n.name) && boundName(el)) {
      boundCount++
    } else if (!meaningful(n.name)) {
      add("field-no-name", el, `${kind} (${ident}) ohne Beschriftung${n.name ? `, Name nur „${n.name}“` : ""}`, ctx)
    } else if (n.src === "placeholder" && f.search) {
      add("no-visible-label", el, `Suchfeld, Name nur aus dem Platzhalter „${short(n.name, 40)}“`, ctx)
    } else if (n.src === "placeholder") {
      add("placeholder-only", el, `Nur Platzhalter „${short(n.name, 40)}“`, ctx)
    } else if (n.src === "title") {
      add("title-only", el, `Nur title „${short(n.name, 40)}“`, ctx)
    } else if (!f.search && type !== "checkbox" && type !== "radio") {
      const noVisible =
        (n.src === "aria-label" && (n.labels.length === 0 || n.labelsSrOnly)) ||
        (n.src === "label" && n.labelsSrOnly) ||
        (n.src === "aria-labelledby" && (() => {
          const r = idsText(doc, el.getAttribute("aria-labelledby") ?? "")
          return r.found.length > 0 && r.found.every((e) => srOnly(e) || isHidden(e))
        })())
      if (noVisible) {
        const ph = clean(el.getAttribute("placeholder"))
        add("no-visible-label", el, `Name „${short(n.name, 40)}“ über ${n.src === "label" ? "eine versteckte Beschriftung" : n.src}${ph ? `, sichtbar nur der Platzhalter „${short(ph, 30)}“` : ""}`, ctx)
      }
    }

    // 2.5.3: sichtbarer Text muss im Namen stecken
    if ((n.src === "aria-label" || n.src === "aria-labelledby") && !n.labelsSrOnly) {
      const vis = words(n.visible.replace(/\*/g, ""))
      if (vis.replace(/\s/g, "").length >= 2 && !words(n.name).includes(vis)) {
        touch("2.5.3")
        add("label-in-name", el, `Sichtbar „${short(n.visible, 40)}“, Name „${short(n.name, 40)}“`, ctx)
      } else if (vis) touch("2.5.3")
    }

    if (n.missingRefs.length) add("aria-ref-missing", el, `aria-labelledby verweist auf „${n.missingRefs.join(" ")}“`, ctx)
    const db = el.getAttribute("aria-describedby")
    if (db) {
      const r = idsText(doc, db)
      if (r.missing.length) add("aria-ref-missing", el, `aria-describedby verweist auf „${r.missing.join(" ")}“`, ctx)
    }

    // 1.3.5 autocomplete
    if (!f.search && !el.hasAttribute("disabled") && !el.hasAttribute("readonly") && (tag(el) === "input" || tag(el) === "select" || tag(el) === "textarea")) {
      const p = purposeOf(el, n.visible || n.name, f.auth)
      if (p) {
        touch("1.3.5")
        const own = el.getAttribute("autocomplete")
        const formAc = (f.form?.getAttribute("autocomplete") ?? "").toLowerCase()
        const label = short(n.visible || n.name || ident, 30)
        const want = p.token === "password" ? "current-password oder new-password" : p.token
        if (own === null) {
          add("autocomplete", el, formAc === "off" ? `„${label}“: Formular setzt autocomplete="off", erwartet autocomplete="${want}"` : `„${label}“: erwartet autocomplete="${want}"`, ctx)
        } else {
          const tokens = own.toLowerCase().split(/\s+/).filter((x) => x && x !== "webauthn")
          const last = tokens[tokens.length - 1] ?? ""
          if (last === "off" || last === "on" || !last) add("autocomplete", el, `„${label}“: autocomplete="${own}" nennt keinen Zweck, erwartet "${want}"`, ctx)
          else if (!AUTOFILL.has(last)) add("autocomplete", el, `„${label}“: ungültiger Wert autocomplete="${short(own, 30)}", erwartet "${want}"`, ctx)
        }
      }
    }

    // Einfügen gesperrt
    const onpaste = el.getAttribute("onpaste") ?? ""
    if (/return\s+false|preventdefault/i.test(onpaste)) {
      const ac = (el.getAttribute("autocomplete") ?? "").toLowerCase()
      if (type === "password" || /current-password|one-time-code/.test(ac) || /pass|pin|tan|otp|code/i.test(el.getAttribute("name") ?? "")) {
        touch("3.3.8")
        add("paste-blocked", el, `onpaste="${short(onpaste, 30)}"`, ctx)
      }
    }

    // Auswahl löst Kontextwechsel aus
    const onchange = el.getAttribute("onchange") ?? ""
    if (type === "select" || type === "radio" || type === "checkbox") touch("3.2.2")
    if (/submit\s*\(|location|window\.open|\.href\s*=|navigate/i.test(onchange)) add("onchange-context", el, `onchange="${short(onchange, 40)}"`, ctx)

    // Fehlermarkierung ohne Meldung
    if (el.getAttribute("aria-invalid") === "true") {
      const refs = clean(`${el.getAttribute("aria-describedby") ?? ""} ${el.getAttribute("aria-errormessage") ?? ""}`)
      if (!refs || !meaningful(idsText(doc, refs).text)) add("invalid-no-message", el, "aria-invalid=\"true\" ohne verknüpfte Meldung", ctx)
    }
  }

  // Optionsgruppen ohne fieldset/legend
  {
    const groups = new Map<string, Field[]>()
    for (const f of fields) {
      if (f.type !== "radio" && f.type !== "checkbox") continue
      const nm = f.el.getAttribute("name")
      if (!nm) continue
      const key = `${f.form ? formEls.indexOf(f.form) : -1}|${f.type}|${nm}`
      groups.set(key, [...(groups.get(key) ?? []), f])
    }
    const groupName = (g: Element) => {
      const lb = g.getAttribute("aria-labelledby")
      return clean(g.getAttribute("aria-label")) || (lb ? idsText(doc, lb).text : "")
    }
    const grouped = (el: Element) => {
      const fs = el.closest("fieldset")
      if (fs) {
        const lg = Array.from(fs.children).find((ch) => tag(ch) === "legend")
        if (lg && meaningful(textOf(lg))) return true
        if (meaningful(groupName(fs))) return true
      }
      const g = el.closest("[role=radiogroup], [role=group]")
      return !!g && meaningful(groupName(g))
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue
      if (list.every((f) => grouped(f.el))) continue
      const first = list[0]
      const container = first.el.closest("fieldset") ?? first.el.parentElement?.parentElement ?? first.el
      const fs = first.el.closest("fieldset")
      add(
        "group-no-fieldset",
        container,
        `${list.length} ${first.type === "radio" ? "Optionsfelder" : "Kontrollkästchen"} mit name="${short(first.el.getAttribute("name") ?? "", 30)}"${fs ? ", fieldset ohne legend" : " ohne fieldset und legend"}`,
        contextOf(first.el)
      )
    }
  }

  // Pflichtfelder mit Sternchen
  {
    const rawText = (() => {
      const clone = body.cloneNode(true) as Element
      clone.querySelectorAll("script, style, template, noscript").forEach((e) => e.remove())
      return clean(clone.textContent)
    })()
    const explained =
      /\*[^*]{0,80}?(pflicht|erforderlich|notwendig|benötigt|zwingend|muss|müssen|required|mandatory|obligatorisch)/i.test(rawText) ||
      /(pflicht\w*|erforderlich\w*|required|mandatory|obligatorisch\w*)[^*]{0,50}?\*/i.test(rawText) ||
      /(mit|durch) (einem )?(\*|stern(chen)?) (gekennzeichnet|markiert|versehen)/i.test(rawText)
    const starred = new Map<string, Field[]>()
    for (const f of fields) {
      const labelRaw = clean(f.n.labels.map((l) => l.textContent ?? "").join(" ")) || clean(f.el.getAttribute("aria-label"))
      if (!labelRaw.includes("*")) continue
      // Erklärung direkt am Sternchen (title, aria-label, versteckter Text)
      let inline = false
      let hiddenStar = false
      for (const l of f.n.labels) {
        l.querySelectorAll("*").forEach((s) => {
          const own = clean(s.textContent)
          if (own === "*" || own === "(*)") {
            if (/pflicht|erforderlich|required|mandatory|muss/i.test(`${s.getAttribute("title") ?? ""} ${s.getAttribute("aria-label") ?? ""}`)) inline = true
            if (ariaHiddenUp(s)) hiddenStar = true
          }
        })
        if (/pflicht|erforderlich|required|mandatory|muss ausgefüllt/i.test(textOf(l))) inline = true
      }
      const required = f.el.hasAttribute("required") || f.el.getAttribute("aria-required") === "true"
      if (hiddenStar && !required && !inline) add("required-hidden-star", f.el, `„${short(f.n.visible, 40)}“ ohne required`, contextOf(f.el))
      if (!inline) {
        const key = contextOf(f.el)
        starred.set(key, [...(starred.get(key) ?? []), f])
      }
    }
    if (starred.size && !explained) {
      for (const [ctx, list] of starred) {
        const lab = list[0].n.labels[0] ?? list[0].el
        add("required-asterisk", lab, `${list.length} ${list.length === 1 ? "Feld" : "Felder"} mit Sternchen, keine Erklärung im Text gefunden`, ctx)
      }
    }
  }

  // Beschriftungen, die ins Leere zeigen; doppelte ids
  {
    doc.querySelectorAll("label[for]").forEach((l) => {
      if (isHidden(l) || !meaningful(textOf(l))) return
      const id = l.getAttribute("for") ?? ""
      const target = id ? doc.getElementById(id) : null
      if (!target) add("label-for-missing", l, `for="${short(id, 30)}": keine id „${short(id, 30)}“ auf der Seite`, contextOf(l))
      else if (!target.matches(LABELABLE)) add("label-for-missing", l, `for="${short(id, 30)}" zeigt auf <${tag(target)}>, kein Formularfeld`, contextOf(l))
    })
    const idCount = new Map<string, number>()
    doc.querySelectorAll("[id]").forEach((e) => idCount.set(idOf(e), (idCount.get(idOf(e)) ?? 0) + 1))
    const referenced = new Map<string, Element>()
    doc.querySelectorAll("label[for]").forEach((l) => referenced.set(l.getAttribute("for") ?? "", l))
    doc.querySelectorAll("[aria-labelledby], [aria-describedby], [aria-errormessage]").forEach((e) => {
      for (const a of ["aria-labelledby", "aria-describedby", "aria-errormessage"]) for (const id of (e.getAttribute(a) ?? "").split(/\s+/)) if (id) referenced.set(id, e)
    })
    for (const [id, el] of referenced) {
      const n = idCount.get(id) ?? 0
      if (n > 1 && !isHidden(el)) add("duplicate-id", el, `id „${short(id, 30)}“ kommt ${n}-mal vor`, contextOf(el))
    }
  }

  // ---------------------------------------------------------------- Schalter und Links
  const buttons = new Set<Element>()
  doc.querySelectorAll("button, input[type=submit i], input[type=reset i], input[type=button i], input[type=image i], [role=button]").forEach((b) => {
    if (isHidden(b) || ariaHiddenUp(b) || b.closest("svg")) return
    buttons.add(b)
  })
  if (buttons.size) touch("4.1.2")
  for (const b of buttons) {
    const n = buttonName(b, c)
    const ctx = contextOf(b)
    const isImg = tag(b) === "input" && (b.getAttribute("type") ?? "").toLowerCase() === "image"
    if (isImg) {
      touch("1.1.1")
      if (!meaningful(n.name)) add("image-button-no-alt", b, "input type=\"image\" ohne alt", ctx)
      continue
    }
    if (!meaningful(n.name) && boundName(b)) {
      boundCount++
    } else if (!n.name) {
      const icon = b.querySelector("svg, img, i, span[class*=icon i], span[class*=fa-]")
      add("button-no-name", b, icon ? "Nur Symbol, kein Text und kein aria-label" : "Kein Text und kein aria-label", ctx)
    } else if (!meaningful(n.name)) {
      add("button-weak-name", b, `Name nur „${short(n.name, 10)}“`, ctx)
    }
    if ((n.src === "aria-label" || n.src === "aria-labelledby") && n.visibleText) {
      const vis = words(n.visibleText)
      if (vis.replace(/\s/g, "").length >= 2) {
        touch("2.5.3")
        if (!words(n.name).includes(vis)) add("label-in-name", b, `Sichtbar „${short(n.visibleText, 40)}“, Name „${short(n.name, 40)}“`, ctx)
      }
    }
    if (n.missingRefs.length) add("aria-ref-missing", b, `aria-labelledby verweist auf „${n.missingRefs.join(" ")}“`, ctx)
  }

  formEls.forEach((f) => {
    if (isHidden(f)) return
    // Links ohne Namen im Formular
    f.querySelectorAll("a[href]").forEach((a) => {
      if (isHidden(a) || ariaHiddenUp(a)) return
      touch("2.4.4")
      const lb = a.getAttribute("aria-labelledby")
      const name = clean(a.getAttribute("aria-label")) || (lb ? idsText(doc, lb).text : "") || clean(textOf(a)) || clean(a.getAttribute("title"))
      if (!meaningful(name)) add("link-no-name", a, "Link ohne Text", contextOf(a))
    })
    // Bilder im Formular ohne alt (CAPTCHA-Bilder gesondert)
    f.querySelectorAll("img").forEach((img) => {
      if (isHidden(img) || ariaHiddenUp(img)) return
      const role = (img.getAttribute("role") ?? "").toLowerCase()
      if (role === "presentation" || role === "none") return
      if (img.getAttribute("width") === "1" || img.getAttribute("height") === "1") return
      if (img.closest("button, a[href]")) return // zählt beim Namen des Schalters oder Links
      if (CAPTCHA_NAME.test(`${img.getAttribute("src") ?? ""} ${idOf(img)} ${classOf(img)} ${img.getAttribute("name") ?? ""}`)) return
      touch("1.1.1")
      if (!img.hasAttribute("alt") && !clean(img.getAttribute("aria-label")) && !img.getAttribute("aria-labelledby")) add("img-no-alt", img, `Datei ${short((img.getAttribute("src") ?? "").split(/[?#]/)[0].split("/").pop() ?? "", 40)}`, contextOf(img))
    })
    // Absenden
    const fieldsHere = fields.filter((x) => x.form === f)
    if (fieldsHere.length >= 2) {
      const submit = f.querySelector("button:not([type]), button[type=submit i], input[type=submit i], input[type=image i]") ?? (idOf(f) ? doc.querySelector(`button[form="${cssEscape(idOf(f))}"], input[type=submit i][form="${cssEscape(idOf(f))}"]`) : null)
      if (!submit) {
        touch("2.1.1", "4.1.2")
        const fake = Array.from(f.querySelectorAll("div, span, a:not([href]), p, li, label")).find((e) => {
          if (e.getAttribute("role") === "button") return false
          if (e.querySelector("input, select, textarea, button")) return false
          const tx = clean(textOf(e))
          return tx.length > 0 && tx.length < 40 && /(^|[\s_-])(btn|button|submit|absenden|send|senden)([\s_-]|$)/i.test(`${classOf(e)} ${idOf(e)}`)
        })
        if (fake) add("fake-submit", fake, `Text „${short(clean(textOf(fake)), 30)}“, keine Schalter-Rolle`, contextOf(fake))
        else if (!f.querySelector("button, [role=button]")) add("no-submit", f, `${fieldsHere.length} Felder, kein Schalter`, contextOf(f))
      }
    }
  })

  // Klickbare Elemente ohne Tastaturzugang
  touch("2.1.1")
  doc.querySelectorAll("[onclick], [role=button]").forEach((e) => {
    const t = tag(e)
    if (["a", "button", "input", "select", "textarea", "summary", "label", "option", "area", "body", "html", "details"].includes(t) && !(t === "a" && !e.hasAttribute("href"))) return
    if (isHidden(e) || ariaHiddenUp(e)) return
    if (e.querySelector("a[href], button, input, select, textarea")) return
    if (e.parentElement?.closest("a[href], button, label, summary")) return
    const oc = clean(e.getAttribute("onclick"))
    if (oc && /^(event\.)?stoppropagation\(\);?$|^return false;?$/i.test(oc)) return
    const ti = e.getAttribute("tabindex")
    if (ti !== null && parseInt(ti, 10) >= 0) return
    if (t === "a" && e.hasAttribute("href")) return
    add("fake-button", e, e.getAttribute("role") === "button" ? "role=\"button\", aber nicht per Tab erreichbar" : `<${t}> mit onclick, nicht per Tab erreichbar`, contextOf(e))
  })

  // aria-hidden auf bedienbaren Elementen
  doc.querySelectorAll("[aria-hidden=true]").forEach((h) => {
    if (isHidden(h)) return
    const cands = [h, ...Array.from(h.querySelectorAll(focusableSel))].filter((e) => {
      if (!e.matches(focusableSel)) return false
      if (e.hasAttribute("disabled") || isHidden(e)) return false
      const ti = e.getAttribute("tabindex")
      if (ti !== null && parseInt(ti, 10) < 0) return false
      return tag(e) !== "iframe"
    })
    if (!cands.length) return
    // Nur Eingabefelder in Formularen melden. Menüs, Dialoge, Schubladen und Suchleisten mit
    // aria-hidden werden fast immer zugleich per CSS ausgeblendet; das sieht die Prüfung nicht.
    if (/(dialog|modal|drawer|offcanvas|off-canvas|popup|pop-up|overlay|flyout|menu|menü|nav|dropdown|search|suche|slider|carousel|swiper|tooltip|layer|panel|sidebar|minicart|cart)/i.test(`${idOf(h)} ${classOf(h)} ${h.getAttribute("role") ?? ""}`)) return
    if (h.closest("[role=dialog], [aria-modal=true], dialog, nav")) return
    const formish = cands.filter((e) => ["input", "select", "textarea"].includes(tag(e)) && !!formOf(e))
    if (formish.length) {
      touch("4.1.2")
      add("aria-hidden-focus", formish[0], `${formish.length} bedienbare${formish.length === 1 ? "s Element" : " Elemente"} in aria-hidden="true"`, contextOf(formish[0]))
    }
  })

  // Positiver tabindex
  touch("2.4.3")
  doc.querySelectorAll("[tabindex]").forEach((e) => {
    const v = parseInt(e.getAttribute("tabindex") ?? "", 10)
    // Sprunglinks ganz oben („Zum Inhalt“) mit tabindex="1" stören die Reihenfolge praktisch nicht
    const skipLink = tag(e) === "a" && (e.getAttribute("href") ?? "").startsWith("#") && /inhalt|content|skip|springe|direkt zu/i.test(clean(e.textContent))
    if (v > 0 && !skipLink && !isHidden(e)) add("tabindex-positive", e, `tabindex="${v}"`, contextOf(e))
  })

  // Fokus: outline im style-Attribut und in eingebettetem CSS
  touch("2.4.7")
  doc.querySelectorAll("[style]").forEach((e) => {
    if (!e.matches(focusableSel) || isHidden(e)) return
    const s = styleOf(e)
    if (/(^|;)outline(-style|-width)?:(none|0)(px)?(!important)?(;|$)/.test(s)) add("outline-inline", e, `style="${short(e.getAttribute("style") ?? "", 50)}"`, contextOf(e))
  })
  {
    // Eingebettetes CSS: Regeln für :focus/:focus-visible, die outline entfernen. Gemeldet wird nur,
    // wenn weder dieselbe Regel noch eine andere Regel für denselben Selektor (oder ein Nachbar wie
    // „:focus-visible + label“) einen anderen Fokus-Effekt setzt.
    const INDICATOR = /(box-shadow:(?!none)|border(-[a-z-]+)?:|background(-color)?:|text-decoration|(^|;)color:|outline-color|outline:(?!none|0)|outline-style:(?!none)|filter:|transform:)/
    const OFF = /(^|;)outline(-style|-width)?:(none|0)(px)?(!important)?(;|$)/
    const rules: { parts: string[]; decl: string; raw: string }[] = []
    doc.querySelectorAll("style").forEach((st) => {
      const css = (st.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, "")
      const re = /([^{}]+)\{([^{}]*)\}/g
      let m: RegExpExecArray | null
      while ((m = re.exec(css))) {
        const sel = m[1].trim()
        if (sel.startsWith("@")) continue
        rules.push({ parts: sel.split(",").map((x) => x.trim()), decl: m[2].toLowerCase().replace(/\s+/g, ""), raw: m[2].trim() })
      }
    })
    let hits = 0
    for (const r of rules) {
      if (hits >= 10) break
      if (!OFF.test(r.decl) || INDICATOR.test(r.decl)) continue
      for (const part of r.parts) {
        if (part.includes("\\:")) continue // Hilfsklassen wie .focus\:outline-none
        const p = part.replace(/:not\([^)]*\)/g, "")
        if (!/:focus(-visible)?(?![-\w])/.test(p)) continue
        if (/\[tabindex="?-1"?\]/.test(part) || /:not\(\s*:focus-visible\s*\)/.test(part)) continue
        const replaced = rules.some((o) => o !== r && INDICATOR.test(o.decl) && o.parts.some((q) => q === part || (q.startsWith(part) && /^\s*[+~> ]/.test(q.slice(part.length)))))
        if (replaced) continue
        hits++
        add("outline-css", null, `${short(part, 70)} { ${short(r.raw, 60)} }`)
        break
      }
    }
  }

  // Rahmen (iframes)
  const providers = new Set<string>()
  doc.querySelectorAll("iframe").forEach((fr) => {
    const src = fr.getAttribute("src") ?? fr.getAttribute("data-src") ?? ""
    for (const [re, name] of PROVIDERS) if (re.test(src)) providers.add(name)
    if (isHidden(fr) || ariaHiddenUp(fr)) return
    if (["0", "1"].includes(fr.getAttribute("width") ?? "") || ["0", "1"].includes(fr.getAttribute("height") ?? "")) return
    if (/recaptcha|hcaptcha|turnstile|googletagmanager/i.test(src)) return
    touch("4.1.2")
    if (!clean(fr.getAttribute("title")) && !clean(fr.getAttribute("aria-label")) && !fr.getAttribute("aria-labelledby")) add("iframe-no-title", fr, src ? `Quelle ${short(src.replace(/^https?:\/\//, "").split(/[?#]/)[0], 50)}` : "iframe ohne title", contextOf(fr))
  })
  doc.querySelectorAll("script[src]").forEach((s) => {
    const src = s.getAttribute("src") ?? ""
    for (const [re, name] of PROVIDERS) if (re.test(src)) providers.add(name)
  })
  doc.querySelectorAll("script:not([src])").forEach((s) => {
    const t = (s.textContent ?? "").slice(0, 20000)
    if (/hbspt\.forms\.create/.test(t)) providers.add("HubSpot")
  })

  // ---------------------------------------------------------------- CAPTCHA
  {
    const srcs = Array.from(doc.querySelectorAll("script[src], iframe[src]")).map((e) => e.getAttribute("src") ?? "")
    const widgets: { name: string; el: Element | null; note: string }[] = []
    const KNOWN: { key: string; cls: RegExp; src: RegExp; note: (el: Element | null, src?: string) => string }[] = [
      {
        key: "Google reCAPTCHA",
        cls: /(^|\s)(g-recaptcha|recaptcha[\w-]*)(\s|$)/i,
        src: /recaptcha/i,
        note: (el, src) =>
          src && /[?&]render=(?!explicit)/i.test(src) && !el
            ? "Google reCAPTCHA v3: arbeitet in der Regel ohne Aufgabe im Hintergrund"
            : el?.getAttribute("data-size") === "invisible"
            ? "Google reCAPTCHA (unsichtbar): zeigt nur bei Verdacht eine Bildaufgabe"
            : "Google reCAPTCHA: Häkchen, bei Verdacht eine Bildaufgabe mit Audio-Alternative",
      },
      { key: "hCaptcha", cls: /(^|\s)h-captcha(\s|$)/i, src: /hcaptcha\.com/i, note: () => "hCaptcha: kann Bildaufgaben zeigen; ein Zugang ohne Aufgabe erfordert eine eigene Registrierung bei hCaptcha" },
      { key: "Cloudflare Turnstile", cls: /turnstile/i, src: /challenges\.cloudflare\.com\/turnstile/i, note: () => "Cloudflare Turnstile: in der Regel ohne Aufgabe, höchstens ein Häkchen" },
      { key: "Friendly Captcha", cls: /(^|\s)frc-captcha(\s|$)/i, src: /friendlycaptcha/i, note: () => "Friendly Captcha: Rechenarbeit für den Computer, keine Aufgabe für Menschen" },
      { key: "ALTCHA", cls: /altcha/i, src: /altcha/i, note: () => "ALTCHA: Rechenarbeit für den Computer, keine Aufgabe für Menschen" },
      { key: "CaptchaFox", cls: /captchafox/i, src: /captchafox/i, note: () => "CaptchaFox: ob und welche Aufgabe erscheint, entscheidet der Dienst im Browser" },
      { key: "mCaptcha", cls: /mcaptcha/i, src: /mcaptcha/i, note: () => "mCaptcha: Rechenarbeit für den Computer, keine Aufgabe für Menschen" },
      { key: "MTCaptcha", cls: /mtcaptcha/i, src: /mtcaptcha/i, note: () => "MTCaptcha: zeigt Zeichen zum Abtippen, mit Audio-Alternative" },
    ]
    const seenProv = new Set<string>()
    doc.querySelectorAll(".g-recaptcha, .h-captcha, .cf-turnstile, .frc-captcha, altcha-widget, [data-sitekey], [class*=captcha i]").forEach((el) => {
      if (tag(el) === "img" || tag(el) === "input" || tag(el) === "label" || isHidden(el)) return
      if (el.parentElement?.closest(".g-recaptcha, .h-captcha, .cf-turnstile, .frc-captcha, altcha-widget, [data-sitekey]")) return
      const c2 = `${classOf(el)} ${tag(el)}`
      let k = KNOWN.find((x) => x.cls.test(c2))
      if (!k) {
        const bySrc = KNOWN.filter((x) => srcs.some((s2) => x.src.test(s2)))
        if (bySrc.length === 1) k = bySrc[0]
      }
      if (!k && !el.hasAttribute("data-sitekey")) return
      const name = k?.key ?? "CAPTCHA-Dienst"
      const f0 = formOf(el)
      const dk = `${name}|${f0 ? formEls.indexOf(f0) : -1}`
      if (seenProv.has(dk)) return
      seenProv.add(dk)
      seenProv.add(name)
      widgets.push({ name, el, note: k ? k.note(el, srcs.find((s2) => k!.src.test(s2))) : "Unbekannter CAPTCHA-Dienst: ob eine Aufgabe erscheint, zeigt sich erst im Browser" })
    })
    for (const k of KNOWN) {
      const src = srcs.find((s2) => k.src.test(s2))
      if (src && !seenProv.has(k.key)) widgets.push({ name: k.key, el: null, note: k.note(null, src) })
    }
    for (const w of widgets) {
      const f = w.el ? formOf(w.el) : null
      const auth = f ? isAuthForm(f) : pageHasPassword
      touch(auth ? "3.3.8" : "1.1.1")
      add(auth ? "captcha-widget-auth" : "captcha-widget", w.el, w.note, w.el ? contextOf(w.el) : undefined)
    }

    // Bild-CAPTCHA
    doc.querySelectorAll("img").forEach((img) => {
      if (isHidden(img)) return
      if (!CAPTCHA_NAME.test(`${img.getAttribute("src") ?? ""} ${idOf(img)} ${classOf(img)} ${img.getAttribute("alt") ?? ""} ${img.getAttribute("name") ?? ""}`)) return
      const f = formOf(img)
      const scope = f ?? img.parentElement?.parentElement ?? body
      const altText = clean(img.getAttribute("alt"))
      const audio = !!scope.querySelector("audio, a[href*=audio i], button[class*=audio i], [aria-label*=audio i], [title*=audio i]") || /audio|anhören|vorlesen|hören/i.test(clean(scope.textContent))
      touch("1.1.1")
      if (!meaningful(altText)) add("captcha-image", img, "Bild-CAPTCHA ohne Alternativtext", contextOf(img))
      else if (!audio) add("captcha-image", img, `Alternativtext „${short(altText, 30)}“, keine Alternative in anderer Form erkennbar`, contextOf(img))
      if (f ? isAuthForm(f) : pageHasPassword) {
        touch("3.3.8")
        add("captcha-auth", img, "Zeichen aus einem Bild abtippen", contextOf(img))
      }
    })

    // Rechen- und Quizaufgaben
    for (const f of fields) {
      const lbl = `${f.n.name} ${f.n.visible}`
      if (!QUIZ.test(lbl) && !/(^|[\W_])(quiz|math|rechen|spamfrage|captcha)([\W_]|$)/i.test(f.el.getAttribute("name") ?? "")) continue
      if (f.form && f.form.querySelector("img") && Array.from(f.form.querySelectorAll("img")).some((i) => CAPTCHA_NAME.test(`${i.getAttribute("src") ?? ""} ${idOf(i)} ${classOf(i)}`))) continue
      if (f.auth) {
        touch("3.3.8")
        add("captcha-auth", f.el, `Aufgabe „${short(f.n.visible || f.n.name, 40)}“`, contextOf(f.el))
      } else add("captcha-quiz", f.el, `Aufgabe „${short(f.n.visible || f.n.name, 40)}“`, contextOf(f.el))
    }
  }

  // ---------------------------------------------------------------- Fehlermeldungen und Status
  const live = doc.querySelectorAll("[role=alert], [role=status], [role=log], [aria-live=polite], [aria-live=assertive], output").length
  {
    const referenced = new Set<string>()
    doc.querySelectorAll("[aria-describedby], [aria-errormessage]").forEach((e) => {
      clean(`${e.getAttribute("aria-describedby") ?? ""} ${e.getAttribute("aria-errormessage") ?? ""}`)
        .split(" ")
        .forEach((id) => id && referenced.add(id))
    })
    const inLive = (e: Element) => !!e.closest("[role=alert], [role=status], [role=log], [aria-live=polite], [aria-live=assertive]")
    formEls.forEach((f) => {
      if (isHidden(f)) return
      f.querySelectorAll("*").forEach((e) => {
        if (!ERR_CLASS.test(`${classOf(e)} ${idOf(e)}`)) return
        if (e.querySelector("input, select, textarea, button, fieldset")) return
        if (isHidden(e)) return
        const tx = clean(textOf(e))
        if (!meaningful(tx) || tx.length > 300) return
        let nested = false
        for (let p = e.parentElement; p && p !== f; p = p.parentElement) if (ERR_CLASS.test(`${classOf(p)} ${idOf(p)}`) && !p.querySelector("input, select, textarea")) nested = true
        if (nested) return
        if (inLive(e)) return
        let linked = false
        for (let n: Element | null = e; n && n !== f; n = n.parentElement) if (idOf(n) && referenced.has(idOf(n))) linked = true
        if (!linked) add("error-unlinked", e, `Meldung „${short(tx, 50)}“`, contextOf(e))
      })
    })
    const realForms = formEls.filter((f) => !isHidden(f) && fields.filter((x) => x.form === f && !x.search).length >= 2)
    if (realForms.length) touch("4.1.3")
    if (realForms.length && live === 0) add("no-live-region", realForms[0], "Kein role=\"alert\", role=\"status\" oder aria-live auf der Seite", contextOf(realForms[0]))
  }

  // ---------------------------------------------------------------- Überschriften
  {
    const heads = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading]")).filter((h) => !isHidden(h) && !ariaHiddenUp(h))
    if (heads.length) touch("2.4.6")
    heads.forEach((h) => {
      if (!meaningful(clean(textOf(h)))) add("heading-empty", h, "Überschrift ohne Text", contextOf(h))
    })
    if (!fragment) {
      const levels = heads.map((h) => (h.getAttribute("role") === "heading" ? parseInt(h.getAttribute("aria-level") ?? "2", 10) || 2 : parseInt(tag(h).slice(1), 10)))
      if (!heads.length) add("headings-none", null, "Keine Überschrift im HTML")
      else {
        if (!levels.includes(1)) add("heading-no-h1", heads[0], `Erste Überschrift ist eine ${heads[0].getAttribute("role") === "heading" ? "role=heading" : tag(heads[0])}`)
        let prev = 0
        heads.forEach((h, i) => {
          const l = levels[i]
          if (prev && l > prev + 1) add("heading-skip", h, `h${prev} direkt auf h${l}`)
          prev = l
        })
      }
    }
  }

  // ---------------------------------------------------------------- Hinweise zum Ergebnis
  if (!fields.length) {
    notes.push(
      "Im HTML ist kein sichtbares Formularfeld zu finden. Wird das Formular per JavaScript nachgeladen, sieht diese Prüfung es nicht. Öffnen Sie die Seite im Browser, kopieren Sie das Formular über die Entwicklerwerkzeuge (Rechtsklick auf das Formular, „Untersuchen“, dann das form-Element als HTML kopieren) und prüfen Sie dieses HTML."
    )
    if (doc.querySelector("#root, #app, #__next, #__nuxt, [ng-app], [data-reactroot], [ng-version]")) notes.push("Die Seite sieht nach einer JavaScript-Anwendung aus. Ihr Inhalt entsteht erst im Browser.")
  }
  if (providers.size) notes.push(`Eingebettete Dienste erkannt: ${Array.from(providers).join(", ")}. Formulare solcher Dienste liegen oft in einem eigenen Rahmen oder entstehen per JavaScript und sind hier nicht geprüft. Prüfen Sie das HTML des eingebetteten Formulars einzeln.`)
  if (/^(just a moment|attention required|access denied|zugriff verweigert|checking your browser|one moment|ddos-guard|please wait|bitte warten|403 forbidden|security check)/i.test(title)) notes.push(`Der Seitentitel „${short(title, 50)}“ deutet auf eine Schutz- oder Fehlerseite hin. Vermutlich hat die Website einen automatischen Abruf abgewehrt. Prüfen Sie dann das HTML aus Ihrem Browser.`)
  if (fragment) notes.push("Das HTML ist ein Ausschnitt ohne <html>-Element. Sprache, Seitentitel und Überschriftenstruktur der ganzen Seite sind deshalb nicht geprüft.")
  if (hiddenCount || honeypotCount || ariaHiddenCount) {
    const parts = []
    if (ariaHiddenCount) parts.push(`${ariaHiddenCount} ${ariaHiddenCount === 1 ? "Feld" : "Felder"} mit aria-hidden="true"`)
    if (hiddenCount) parts.push(`${hiddenCount} ${hiddenCount === 1 ? "ausgeblendetes Feld" : "ausgeblendete Felder"} (hidden oder display:none)`)
    if (honeypotCount) parts.push(`${honeypotCount} ${honeypotCount === 1 ? "Feld, das wie eine Spamschutz-Falle aussieht" : "Felder, die wie Spamschutz-Fallen aussehen"}`)
    notes.push(`Nicht mitgeprüft: ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}` : parts[0]}.`)
  }
  if (boundCount) notes.push(`${boundCount} ${boundCount === 1 ? "Element erhält" : "Elemente erhalten"} Namen oder Text erst per JavaScript (zum Beispiel :aria-label oder x-text). Diese Namen sind hier nicht bewertet; prüfen Sie sie im Browser.`)
  if (fields.length && doc.querySelectorAll("script").length > 25) notes.push("Die Seite nutzt viel JavaScript. Manche Beschriftungen entstehen womöglich erst im Browser. Prüfen Sie kritische Befunde im Browser nach, etwa in der Barrierefreiheitsansicht der Entwicklerwerkzeuge, oder prüfen Sie das HTML von dort.")
  const extCss = doc.querySelectorAll("link[rel~=stylesheet i]").length
  if (extCss) notes.push(`${extCss} externe ${extCss === 1 ? "Stylesheet-Datei wurde" : "Stylesheet-Dateien wurden"} nicht geladen. Fokus-Stile, Kontraste und versteckte Elemente darin sind nicht berücksichtigt.`)

  // ---------------------------------------------------------------- Ergebnis
  const findings: Finding[] = []
  for (const [id, items] of found) {
    const d = RULES[id]
    findings.push({ id, crit: d.crit, sev: d.sev, title: d.title, explain: d.explain, fix: d.fix, code: "code" in d ? d.code : undefined, ref: "ref" in d ? d.ref : undefined, items })
  }
  const sevIdx = (s: Severity) => SEVERITIES.indexOf(s)
  findings.sort((a, b) => sevIdx(a.sev) - sevIdx(b.sev) || (a.crit === "empfehlung" ? 1 : 0) - (b.crit === "empfehlung" ? 1 : 0) || critSort(a.crit).localeCompare(critSort(b.crit)) || a.title.localeCompare(b.title))
  const counts = { kritisch: 0, hoch: 0, mittel: 0, hinweis: 0 } as Record<Severity, number>
  let places = 0
  for (const f of findings) {
    counts[f.sev]++
    places += f.items.length
  }
  const criteria: CritStatus[] = (Object.keys(CRITERIA) as CritId[])
    .filter((id) => touched.has(id) || findings.some((f) => f.crit === id))
    .map((id) => {
      const fs = findings.filter((f) => f.crit === id)
      return { id, state: fs.some((f) => f.sev !== "hinweis") ? "befund" : fs.length ? "hinweis" : "ok" } as CritStatus
    })

  const forms: FormSummary[] = formEls
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => (perForm.get(f) ?? 0) > 0)
    .map(({ f, i }) => ({
      index: i + 1,
      label: formLabels[i],
      fields: perForm.get(f) ?? 0,
      kind: isAuthForm(f) ? "anmeldung" : fields.some((x) => x.form === f && x.search) && (perForm.get(f) ?? 0) <= 2 ? "suche" : "formular",
    }))

  return {
    source,
    label: opts.label,
    checkedAt: new Date().toISOString(),
    title,
    lang,
    fragment,
    forms,
    fields: fieldCount,
    fieldsOutside: outside,
    findings,
    counts,
    places,
    criteria,
    patterns: {
      describedby: fields.filter((f) => f.el.hasAttribute("aria-describedby")).length,
      invalid: fields.filter((f) => f.el.getAttribute("aria-invalid") === "true").length,
      required: fields.filter((f) => f.el.hasAttribute("required") || f.el.getAttribute("aria-required") === "true").length,
      live,
    },
    notes,
    skipped: { hidden: hiddenCount, honeypot: honeypotCount },
  }
}
