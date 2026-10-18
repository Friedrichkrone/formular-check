// CSS.escape nach CSSOM (https://drafts.csswg.org/cssom/#serialize-an-identifier).
// Eigene Fassung, weil es das globale CSS-Objekt in Node.js und jsdom nicht gibt.

export function cssEscape(value: string): string {
  let out = ""
  const len = value.length
  const first = value.charCodeAt(0)
  for (let i = 0; i < len; i++) {
    const c = value.charCodeAt(i)
    const digit = c >= 0x30 && c <= 0x39
    if (c === 0) {
      out += "�"
    } else if ((c >= 0x1 && c <= 0x1f) || c === 0x7f || (i === 0 && digit) || (i === 1 && digit && first === 0x2d)) {
      out += "\\" + c.toString(16) + " "
    } else if (i === 0 && len === 1 && c === 0x2d) {
      out += "\\" + value.charAt(i)
    } else if (c >= 0x80 || c === 0x2d || c === 0x5f || digit || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) {
      out += value.charAt(i)
    } else {
      out += "\\" + value.charAt(i)
    }
  }
  return out
}
