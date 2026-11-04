# CodeEvidence synthetic slice — implementation result (resume session 2026-11-04, ~02:35-02:45 UTC)

Synthetic demo data only. Fictional rule pack `ce-structural-1`. No clinical, coding, legal or
regulatory authority anywhere in this repository. The tests below are the author's own checks;
they are **not** an independent audit. Source is unverified until the root reviewer checks it.

## Test command and result

```
node --test "tests/**/*.test.js"
```

Final run (02:40 UTC, Node 24, from the product checkout root):

```
ℹ tests 37
ℹ suites 0
ℹ pass 37
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Pass 37 / fail 0 / total 37. State at the start of the session: 36 pass / 1 fail
(`adversarial 6`), and `npm test` (`node --test tests/`) failed outright on Node 24.

## Files changed in this session

| File | Change |
|---|---|
| `package.json` | `"test"` script changed from `node --test tests/` to `node --test "tests/**/*.test.js"` (the directory form fails on Node 24). |
| `src/report.js` | `buildCsv` now writes, for each finding row, the original values of the cited input records resolved from the frozen `report.input` snapshot: submission `memberId`, `encounterId`, `codeRef`; association `illustrativeStatus`; document `documentMemberId`, `documentEncounterId`, `serviceDate`, `signatureMetadataPresent`. `CSV_COLUMNS` is exported. New private helper `citedInput`. Column `dataLabel` stays last. |
| `tests/export.test.js` | Header snapshot assertion updated to the new 20-column list; two row-shape assertions added (S2 NO_ASSOCIATION row carries `M2,E2,C-B` and empty link/document cells; S4 OUTSIDE_DEMO_WINDOW row carries `L4,unreviewed,D3,M4,E4,2025-12-31,false`). See "Test correction". |
| `app/index.html` | Dead link `../index.html` (no root landing page exists) now points at `../README.md`; export panel copy mentions the cited-record columns in the CSV. |

## Files added in this session

- `README.md` — purpose, synthetic/fictional/no-authority disclaimer, run instructions, input contract, rule pack, report shape, exports, limitations.
- `docs/IMPLEMENTATION-RESULT.md` — this file.

No files were deleted. No dependencies were added. No git, CI, network or deployment actions were taken.

## Fixes made

1. **`npm test` on Node 24.** Glob form `"tests/**/*.test.js"` replaces the directory argument.
2. **`adversarial 6` (spec clause 6: script/HTML/formula text renders inert; safe CSV prevents
   spreadsheet formula execution; exports retain traceable original values in JSON).**
   Root cause: the failing assertion (`tests/adversarial.test.js:126`) requires the CSV to contain
   the neutralized cell `"'=HYPERLINK(""http://evil.example"")"` or `"'+1-C"`. Those payloads are the
   hostile fixture's submission/document `memberId` and `codeRef`; the previous CSV only emitted
   finding-level identifiers, so the payloads never reached the CSV at all. `escapeHtml`, `csvCell`
   neutralization (`= + - @ TAB CR` → leading apostrophe) and the JSON export's raw-value retention
   were already correct and unchanged. The fix extends the CSV so each finding row repeats the
   original values of the records it cites, all passing through `csvCell`. No test was weakened;
   the adversarial test is untouched.
3. **Dead "About this demo" link** in `app/index.html` repaired (points at the README served by
   `scripts/serve.mjs` as text/markdown).

## Test correction (recorded explicitly)

- `tests/export.test.js`, test `csv: RFC 4180 quoting, CRLF rows, formula neutralization ...`:
  the exact-header assertion listed the previous 12 CSV columns. It was a snapshot of the old column
  set, not a spec requirement — the spec does not define CSV columns; it requires "safe CSV prevents
  spreadsheet formula execution; exports retain traceable original values" (clause 6) and "export all
  six findings and decisions" (Journey). Satisfying `adversarial 6` as written requires the CSV to
  carry the cited submission's `memberId`/`codeRef`, which is impossible with the old 12-column header.
  The assertion was therefore updated to the new 20-column header (still an exact equality) and
  strengthened with two row-shape checks. Row count (`1 + 6 + 1`), note neutralization, decision and
  trailing `dataLabel` assertions are unchanged.

## UI status

- `app/index.html` + `app/app.js` + `app/ui.js` are wired to the **real engine** from `src/`:
  `parseInput` (fixture select or local JSON file import, 1 MiB pre-check, atomic rejection with
  row-level error list), `runValidation`, `filterFindings` (rule, entity search, missing-association
  toggle), evidence drill-down (`citedRecords` shows the original submission/association/document/
  canonical records, rule version and provenance), reviewer note/decision layer (bounded, never
  mutates findings), `buildExport` + `serializeExport` (JSON with SHA-256 `sourceHash` via
  `crypto.subtle`) and `buildCsv` (CSV). All data reaches the DOM via `textContent`; no `innerHTML`
  with data, no `eval`, no external URLs/fonts/CDNs (enforced by `adversarial 7`).
- `scripts/serve.mjs` is loopback-only (127.0.0.1) with CSP `connect-src 'none'`; smoke-tested in
  this session by starting it, fetching `/app/index.html`, `/app/app.js`, `/app/ui.js`, `/README.md`,
  `/src/index.js`, `/fixtures/index.js` over loopback (all 200 with correct MIME types; unknown path
  404; encoded `../` traversal 403), and stopping it (no process left running).
- **Not done in the UI:** no browser-rendered inspection (no browser tooling in this session), no
  root landing page, no design pass beyond the existing evidence-board styling; the website playbook
  was read but only its "small fix" scale applied (one link + one copy line).

## Known limitations / not done

- Tests are the author's own checks, not an independent audit; root verification pending.
- No real-record path exists or is tested; synthetic fixtures only (by design).
- No CMS year-specific rules, clinical review, ICD/HCC mappings or repayment math (spec exclusions).
- No persistence, authentication, tenancy or reviewer roles (spec: fail-before-deploy; nothing to deploy).
- CSV formula neutralization alters the text of formula-leading cells (leading apostrophe); exact raw
  values are preserved only in the JSON export, as the spec states.
- UI not verified in a real browser in this session; `npm run serve` + manual check still required.
