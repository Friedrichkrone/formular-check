// Öffentliche Schnittstelle von @schwerpunkt/formular-check (ohne Node-Abhängigkeiten).
// In Node.js stattdessen "@schwerpunkt/formular-check/node" verwenden, das HTML mit jsdom liest.

export {
  analyze,
  analyzeDocument,
  analyzeHtml,
  snippet,
  type AnalyzeOptions,
  type CritStatus,
  type Finding,
  type FindingItem,
  type FormSummary,
  type Report,
} from "./analyze.js"
export { CRITERIA, critLabel, critSort, quickRef, type CritId, type CritRef, type Criterion, type Level } from "./criteria.js"
export { RULES, SEVERITIES, SEVERITY_LABEL, SEVERITY_TEXT, type RuleDef, type RuleId, type Severity } from "./rules.js"
export { CHECK_SCOPE, LIMITS } from "./limits.js"
export { formatDate, summaryLine, textReport } from "./report.js"
export { EXAMPLE_HTML } from "./example.js"
export { VERSION } from "./version.js"
