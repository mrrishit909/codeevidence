# CodeEvidence public site: design decision

Status: implemented as static markup. Codex built the production site and inspected Chrome renders at
1440, 1100, 768 and 390 CSS px. The document/body stayed within the viewport at every size. Keyboard,
contrast and reduced-motion checks remain unverified; code alone is not visual evidence.

Files: `index.html` (root landing), `app/landing.css` (landing styles). No landing JS was needed:
the golden-case register is static markup transcribed from the fixture, so the page has no script
at all (`script-src 'none'` in its meta CSP).

## Inputs actually read

| Read | Details |
|---|---|
| Product inputs | `app/index.html`, `app/app.js`, `app/ui.js`, `fixtures/index.js`, `scripts/build.mjs`, `scripts/serve.mjs`, `README.md`, `docs/IMPLEMENTATION-RESULT.md`, `src/rules.js`, `tests/golden.test.js`, `tests/adversarial.test.js`, `../atlas/docs/specs/CODEEVIDENCE-VERTICAL-SLICE.md`, `../atlas/docs/design/VISUAL-DIRECTIONS.md`, `../atlas/docs/design/COMPONENT-STANDARDS.md` |
| Website guidance | `/Users/rishitmathurrishit/.agents/skills/website-playbook/SKILL.md`, `references/quality-rubric.md`, `references/motion-and-assets.md` |

The only link to the spec is the comment in `fixtures/index.js:17` stating the golden fixture is the
exact fixture from CODEEVIDENCE-VERTICAL-SLICE.md. Conformance to VISUAL-DIRECTIONS and
COMPONENT-STANDARDS is **not claimed**; a reviewer with access should check the page against them.

## Three directions

**A. Clinical evidence index (chosen).** A single ruled leaf from a research register. Left page:
submission code references with their visible source fields. Gutter: the supplied association,
drawn as an iron-gall thread with its ID and supplied status text. Right page: the document record.
Outer margin: the structural findings, in the same ink as the thread. Typography: an old-style
system serif (Iowan / Palatino) for prose and headings, monospace for every record field, small
uppercase sans for field labels. Palette: bone paper, indigo-black ink, one oxblood accent.
Motion: threads draw across the gutter row by row, then margin notes settle. Mobile: each entry
becomes a vertical sequence, submission, thread, document record, margin.

**B. Chain-of-custody ledger.** A vertical timeline of tagged evidence handoffs, seal numbers and
custody signatures. Rejected: it visually promises provenance and custody assurance. CodeEvidence
explicitly cannot verify where a record came from, so the metaphor would overclaim.

**C. Printer's proof sheet.** Records set as galley proofs with proofreader's correction marks in
the margin. Rejected: correction marks imply the product corrects records or codes, which sits too
close to coding and upcoding. CodeEvidence flags structure and changes nothing.

**Why A.** It is the only direction whose central image is the product's real job: two sources set
side by side with the explicit link between them and a human margin. It carries the actual golden
fixture as its hero instead of decoration, it differs from a healthcare dashboard (no cards, no
charts, no badges, no medical imagery), and it extends the workbench's existing paper-and-thread
language rather than contradicting it.

## Tokens

| Token | Value | Role |
|---|---|---|
| `--bone` | `#efeadf` | page ground |
| `--leaf` | `#f9f6ee` | folio leaf, verdict box |
| `--ink` | `#1d1b25` | text, primary rules, CTA fill |
| `--ink-2` | `#565160` | field names, secondary text (approx. 7:1 on leaf, computed by hand, not measured) |
| `--rule` | `#cbc3b1` | hairlines |
| `--gall` | `#8a2b1d` | association thread, findings, cited fields |
| `--gall-wash` | `#f0ded5` | background behind a cited field |

Type: `--serif` Iowan Old Style / Palatino Linotype / Palatino / Book Antiqua / URW Palladio L /
Georgia; `--mono` ui-monospace / SF Mono / Menlo / Consolas; `--sans` system UI. Headline
`clamp(2rem, 5.2vw, 3.6rem)` weight 500. No webfonts; rendering will differ by OS (Palatino on
Windows, Iowan on Apple, Georgia fallback elsewhere).

Deliberate absences: no green anywhere, no success colour. `asserted_support` and zero findings are
never styled as a pass. Supplied status is always set in monospace quotes under the label
"status, supplied fixture text".

Layout: one `<ol>` of six entries, each with submission `<dl>`, link block, document `<dl>`, margin.
Phone (<700px): stacked sequence with a vertical thread. Tablet (700-1099px): three-column split
register, margin notes run under each row. Desktop (>=1100px): four columns, findings in the outer
margin. No duplicated DOM, no scaled table.

Motion (all inside `prefers-reduced-motion: no-preference`; the default is the finished static page):
hero rise, thread draw per row (vertical on phone, horizontal from 700px), staggered margin settle,
stamp press, CTA arrow and offset shadow, nav underline grow. The workflow, rule pack and boundary
sections stay deliberately still (a scroll-linked reveal was drafted and removed because it could
hide content in static captures). Hover row wash only on `(hover: hover)`. Nothing requires hover
or motion to read. The intro stagger finishes at about 1.8s.

**Capture note for the reviewer:** take stills with reduced motion emulated, or wait at least 2s
after load; record the intro sequence separately.

## Facts and their sources

| Page fact | Source |
|---|---|
| All six submissions, four documents, five associations, field names and values exactly as in the fixture (including `signatureMetadataPresent` true/false) | `fixtures/index.js:18-42` (GOLDEN) |
| Per-submission findings: S1 none; S2 NO_ASSOCIATION; S3 MEMBER_MISMATCH (L3); S4 OUTSIDE_DEMO_WINDOW and SIGNATURE_METADATA_MISSING (L4); S5 ASSERTED_CONFLICT (L5); S6 DUPLICATE_SUBMISSION, canonical S1 | `tests/golden.test.js:33-48` |
| Totals 6 / 4 / 5, 5 flagged, 1 structurally consistent, 6 findings | `tests/golden.test.js:12-31` |
| Rule IDs, levels, descriptions, window 2026-01-01..2026-12-31, provenance `fictional-demo-configuration` | `src/rules.js` |
| Schema `code-evidence-demo-1`, bounds, export contents, CSV neutralization | `README.md`, `fixtures/index.js:6` |
| Four reviewer decisions, 2,000-character note | `app/ui.js:45-53`, `README.md` |
| Fixtures offered in the app: Golden, Clean, Empty; no file import | `fixtures/index.js:173`, `app/app.js:374-375` |

The engine was not executed for this page; its values come from the test oracle and were compared
with the literal fixture/spec, not from a fresh run of the landing page. Reproduce in the workbench
by loading "Golden fixture" and running validation. If the engine and the page ever disagree, the
engine is right and the page is stale.

## Boundary copy present on the page

Synthetic-only strip above the masthead; "never hold real patient data"; no upload or file import;
not CMS/RADV, clinical, coding, legal or regulatory guidance; no diagnosis, codes, medical
necessity or clinical support; no repayment calculation; no HIPAA certification, privacy assurance
or access control; provenance not verified; supplied status never inferred; zero findings means
"structurally consistent, human clinical review required". No privacy or security claim is made
beyond "no network calls, no account".

## Eight-criterion rubric

| Criterion | Intended outcome | Implementation | Evidence inspected | Status | Remaining correction |
|---|---|---|---|---|---|
| Point of view | A research-register folio, not a dashboard | Split register leaf with thread gutter and margin findings | Distinct folio composition visible at 1440, 1100, 768 and 390 | Mixed | Review detailed hero rows at normal desktop zoom |
| Typography | Literate serif plus exact monospace fields, legible at small sizes | System serif / mono / sans roles, small caps labels | Four rendered widths inspected; fields remain aligned | Mixed | Check fallback fonts on non-Apple OS; assess label size at normal viewing scale |
| Colour | Restrained, one accent, no pass-colour | Bone, ink, oxblood only | Screenshots inspected; contrast not measured | Unverified | Measure all text/state pairs with axe or DevTools |
| Hierarchy | Register is the first concrete thing seen; one primary action | Short hero then folio; one CTA (repeated once at the end) | At 1440x900 the folio begins in the first viewport after the short hero | Mixed | Confirm primary action prominence at 390px |
| Imagery | Product proof as the image; original SVG mark only | Golden fixture rows; inline SVG wordmark; CSS threads | Screenshots show the fixture register itself is the main visual | Mixed | Judge whether the threads read as links, not decoration |
| Motion | Thread draw tells the linking story once, then gets out of the way | CSS keyframes gated on reduced motion; lower sections intentionally still | Not watched in motion | Unverified | Record load sequence; confirm reduced-motion shows the full static page |
| Mobile | Stacked source-to-record sequence, no scaled table | Phone layout below 700px; rule table becomes stacked rows | 390px Chrome screenshot inspected; document/body widths both 390; no horizontal overflow. 768px also inspected | Mixed | Keyboard pass and phone browser review of long rule IDs |
| Invisible quality | Semantic, keyboard reachable, CSP clean, subpath safe | Skip link, landmarks, `dl`/`ol`/`table` with `scope`, `:focus-visible`, relative `./app/` paths, meta CSP with no script | Build passed; served from dist; 1440/1100/768/390 widths inspected; no scripts or inline style | Mixed | axe, keyboard, reduced motion and live `/codeevidence/` Pages verification remain unverified |

## Known unknowns

- No axe, Lighthouse, keyboard, screen-reader or reduced-motion pass was performed.
- `app/index.html` still links "About this demo" to `../README.md`, which `scripts/build.mjs` does
  not ship, so it will 404 on Pages. Left unchanged (out of scope for this pass); flag for a fix.
- `README.md:32-33`, `README.md:131` and `docs/IMPLEMENTATION-RESULT.md` still say there is no
  root landing page; now stale, left unedited (outside this pass's file list).
- The document column is narrowest just above the 1100px breakpoint; check about 1100px for field
  names or values spilling into the margin column, not only 1440/768/390.
- GitHub Pages ignores `dist/_headers`; on Pages only the root page's meta CSP applies, and the
  workbench at `app/` has no meta CSP at all.
