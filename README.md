# CodeEvidence — first executable synthetic slice

> **SYNTHETIC DEMO DATA ONLY. FICTIONAL RULE PACK. NO AUTHORITY.**
> Every member, encounter, document and code reference in this repository is fictitious.
> The rule pack `ce-structural-1` is a fictional, versioned demo configuration defined in
> `atlas/docs/specs/CODEEVIDENCE-VERTICAL-SLICE.md`. It is **not** CMS policy, **not** RADV
> guidance, **not** clinical, coding, legal or regulatory advice, and this demo is **not**
> HIPAA or RADV certification. Zero findings means *structurally consistent, human clinical
> review required* — never "clinically supported". Nothing here diagnoses, codes, upcodes,
> infers clinical support from text, calculates repayment or submits anything anywhere.

## Purpose

A deterministic, dependency-free engine (Node 24, ESM) that runs **structural** checks over
labelled synthetic risk-adjustment-style records: submissions, documents and the explicit
associations between them. It flags administrative inconsistencies (missing association,
duplicate tuple, member/encounter mismatch, service date outside an illustrative window,
missing signature metadata, a supplied `asserted_conflict` status). A small static workbench
UI drives the same engine in the browser for review, drill-down, reviewer notes and export.

## Run

Requires Node >= 24. No `npm install` is needed; there are no dependencies.

```sh
npm test          # = node --test "tests/**/*.test.js"
npm run serve     # = node scripts/serve.mjs  (loopback only: http://127.0.0.1:8787/app/index.html)
```

`scripts/serve.mjs` binds to 127.0.0.1 only, serves this directory read-only with
`Cache-Control: no-store` and a restrictive CSP (`connect-src 'none'`). Stop it with Ctrl-C.
There is no root landing page; the workbench's "About this demo" link opens this README as
served text/markdown.

## Input contract (`schemaVersion: "code-evidence-demo-1"`)

Input is one JSON object. Validation is **atomic**: any error means no data and no report
(`{ ok: false, errors: [{ code, path, message }] }`, at most 200 errors), never partial state.

| Field | Rules |
|---|---|
| `schemaVersion` | must equal `code-evidence-demo-1` |
| `ruleVersion` | optional; when present must equal `ce-structural-1` |
| `submissions[]` | `submissionId` (unique), `memberId`, `encounterId`, `codeRef` — all non-empty strings <= 200 chars |
| `documents[]` | `documentId` (unique), `memberId`, `encounterId`, `serviceDate` (`YYYY-MM-DD`, real calendar day, leap years handled, no time zone), `signatureMetadataPresent` (boolean) |
| `associations[]` | `associationId` (unique), `submissionId` and `documentId` (must exist), `illustrativeStatus` in `asserted_support \| asserted_conflict \| unreviewed` |

Unknown keys anywhere (root or record) are rejected (`UNKNOWN_KEY`), so free text cannot ride
along and alter identity. Unknown references reject the import (`UNRESOLVED_REFERENCE`) instead
of becoming findings. Bounds: 1 MiB input, 1,000 submissions, 2,000 documents, 5,000 associations,
200-character IDs/code references, JSON nesting depth 8, 2,000-character reviewer notes,
10 MiB export. Counts use checked safe-integer arithmetic.

## Rule pack `ce-structural-1` (fictional)

Illustrative window `2026-01-01 .. 2026-12-31` inclusive, compared as calendar days.

| Rule | Level | Fires when |
|---|---|---|
| `NO_ASSOCIATION` | submission | the submission has no association |
| `DUPLICATE_SUBMISSION` | submission | exact `(memberId, encounterId, codeRef)` tuple repeats; the lowest `submissionId` (code-unit order) is canonical, every later member is flagged |
| `MEMBER_MISMATCH` | association | document `memberId` != submission `memberId` |
| `ENCOUNTER_MISMATCH` | association | document `encounterId` != submission `encounterId` |
| `OUTSIDE_DEMO_WINDOW` | association | document `serviceDate` outside the window |
| `SIGNATURE_METADATA_MISSING` | association | `signatureMetadataPresent === false` |
| `ASSERTED_CONFLICT` | association | supplied status is `asserted_conflict` (a fixture statement, not a conclusion) |

Each association rule is evaluated independently; one good link never cancels a bad one.
Findings are sorted by `(submissionId, associationId-or-empty, ruleId)` and are deterministic
under any input ordering.

## Report shape

`validateText(text)` returns `{ ok: true, report }` or `{ ok: false, errors }`. The report is a
**deep-frozen** snapshot:

```
{
  schemaVersion, ruleVersion, rulePack: { ruleVersion, window, provenance, rules }, synthetic: true,
  syntheticLabel, disclaimer,
  input: <deep copy of the validated input, caller order preserved>,
  summary: { submissions, documents, associations, flaggedSubmissions,
             structurallyConsistentSubmissions, structurallyConsistentLabel, findings, countsByRule },
  findings: [{ findingId, ruleId, ruleVersion, level, submissionId, associationId, documentId,
               canonicalSubmissionId, message, details }]
}
```

There are no financial totals and no clinical outcome fields. Reviewer notes and decisions live in a
separate layer (`buildExport` / `buildCsv` options) and never modify a finding.

## Exports

- **JSON** (`buildExport` + `serializeExport`): `exportVersion code-evidence-export-1`, schema and rule
  versions, rule-pack provenance, synthetic label, caller-supplied `generatedAt` and SHA-256
  `sourceHash` of the raw input, the input snapshot with **original, unmodified values**, summary,
  findings, notes and decisions. 10 MiB cap enforced in memory.
- **CSV** (`buildCsv`): RFC 4180, every field quoted, inner quotes doubled, CRLF rows. One row per
  finding, with the original values of the cited submission (`memberId`, `encounterId`, `codeRef`),
  association (`illustrativeStatus`) and document (`documentMemberId`, `documentEncounterId`,
  `serviceDate`, `signatureMetadataPresent`), plus `decision`, `note` and a `dataLabel` column fixed
  to `synthetic demo data`. Cells beginning with `=`, `+`, `-`, `@`, tab or CR get a leading
  apostrophe so spreadsheets do not execute them. Traceability of exact raw values is the JSON
  export's job; the CSV is the spreadsheet-safe view.

The workbench renders all data via `textContent` (never `innerHTML`), has no `eval`, no network
calls, no external fonts/CDNs, and only reads the bundled synthetic fixtures. There is no file-import
control in the public demo UI (Atlas seeded-only gate); the strict `parseInput` engine and its parser
tests remain in `src/` and `tests/`.

## Layout

```
src/        engine: dates.js integers.js freeze.js schema.js rules.js engine.js report.js index.js
fixtures/   labelled synthetic fixtures (golden, clean, empty, adversarial)
tests/      node:test suites (golden oracle, schema, determinism, immutability, export, adversarial, ui helpers)
app/        static workbench (index.html, app.js, ui.js) wired to src/
scripts/    serve.mjs loopback static server
docs/       IMPLEMENTATION-RESULT.md
```

## Limitations (explicit)

- Synthetic selection only. The public UI offers bundled fixtures and nothing else; the parser is
  tested with synthetic fixtures and has never been run against real records and must not be.
- No CMS year-specific rules, no clinical record review, no ICD/HCC mappings, no repayment math.
  Those are excluded until separately sourced, versioned and specialist-validated.
- No authentication, tenancy, reviewer roles or persistence; notes and decisions live in page
  memory until exported.
- The tests in `tests/` are the author's own checks, not an independent audit or verification.
- No root landing page; UI behaviour has not been inspected in a browser in this session.
- The CSV neutralizes formula-leading cells with an apostrophe, which alters those cells' text;
  use the JSON export when exact original values are required.
