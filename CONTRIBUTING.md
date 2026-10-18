# Contributing

Thank you for helping. Bug reports, new test cases and pull requests are welcome.

## Setup

```sh
npm install
npm test          # vitest
npm run typecheck # TypeScript without emitting files
npm run build     # library and CLI in dist/
```

Node.js 22.12 or newer is required.

## Reporting a false alarm or a missed barrier

Please include a **minimal HTML example** that shows the problem, the finding you got and the one you expected. Do not paste pages that contain personal data, and do not name third-party websites; reduce the markup to the form itself.

## Ground rules

* **Static only.** Rules may only use what is in the HTML source. If a rule cannot decide reliably, it reports a hint (`hinweis`) instead of a failure.
* **Every finding names its source.** New rules get a WCAG 2.2 success criterion, or `empfehlung` with a link to a W3C document, a severity, an explanation, a fix and if possible a short code example.
* **Before and after.** New rules come with a test: HTML that triggers the rule and corrected HTML that does not. The files in `examples/` must keep producing no findings in their corrected version.
* **Plain German texts.** User-facing texts are German and written for people without technical background. Code and tests may be in English.
* **No network access.** The library and the CLI must not fetch anything.

## Pull requests

1. Open an issue first for larger changes, so we can agree on the approach.
2. Keep pull requests focused. Add or update tests.
3. Make sure `npm test`, `npm run typecheck` and `npm run build` pass.

By contributing you agree that your contribution is licensed under the MIT License of this project.
