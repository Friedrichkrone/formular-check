import { describe, expect, it } from "vitest"
import { analyzeHtml as browserAnalyze } from "../src/index.js"
import { cssEscape } from "../src/css-escape.js"
import { critLabel, critSort, quickRef } from "../src/criteria.js"

describe("cssEscape", () => {
  it.each([
    ["kontakt", "kontakt"],
    ["1form", "\\31 form"],
    ["-", "\\-"],
    ["-1a", "-\\31 a"],
    ['a"b', 'a\\"b'],
    ["a b", "a\\ b"],
    ["über", "über"],
  ])("%s", (input, out) => expect(cssEscape(input)).toBe(out))
})

describe("criteria", () => {
  it("labels and links WCAG criteria", () => {
    expect(critLabel("1.3.5")).toBe("1.3.5 Bestimmung des Eingabezwecks (Stufe AA)")
    expect(quickRef("4.1.2")).toBe("https://www.w3.org/WAI/WCAG22/quickref/#name-role-value")
    expect(["4.1.2", "1.3.5", "1.1.1", "2.4.11"].sort((a, b) => critSort(a).localeCompare(critSort(b)))).toEqual(["1.1.1", "1.3.5", "2.4.11", "4.1.2"])
  })
})

describe("browser entry point", () => {
  it("asks for a parser when no DOMParser exists", () => {
    expect(globalThis.DOMParser).toBeUndefined()
    expect(() => browserAnalyze("<form></form>")).toThrow(/Kein HTML-Parser/)
  })
})
