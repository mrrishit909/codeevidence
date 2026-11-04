import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as engine from '../src/index.js';
import {
  ADV_DUPLICATE_IDS,
  ADV_UNKNOWN_REFERENCE,
  ADV_INVALID_ENUM,
  ADV_TRIPLE_DUPLICATE,
  ADV_WINDOW_BOUNDARY,
  ADV_IMPOSSIBLE_DATE,
  ADV_MULTI_LINK,
  ADV_HOSTILE_TEXT,
  FIXTURES,
  ADVERSARIAL_FIXTURES,
  GOLDEN,
  fixtureText,
} from '../fixtures/index.js';

const { parseInput, validateText, buildCsv, buildExport, escapeHtml, LIMITS } = engine;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('adversarial 1: duplicate IDs, unknown references and invalid enum reject atomically with row-level errors', () => {
  const dup = parseInput(fixtureText(ADV_DUPLICATE_IDS));
  assert.equal(dup.ok, false);
  assert.ok(!('data' in dup));
  assert.ok(dup.errors.some((e) => e.code === 'DUPLICATE_ID' && e.path === 'submissions[1].submissionId'));
  assert.ok(dup.errors.some((e) => e.code === 'DUPLICATE_ID' && e.path === 'documents[1].documentId'));

  const ref = parseInput(fixtureText(ADV_UNKNOWN_REFERENCE));
  assert.equal(ref.ok, false);
  assert.ok(ref.errors.some((e) => e.code === 'UNRESOLVED_REFERENCE' && e.path === 'associations[0].submissionId'));
  assert.ok(ref.errors.some((e) => e.code === 'UNRESOLVED_REFERENCE' && e.path === 'associations[1].documentId'));
  const asReport = validateText(fixtureText(ADV_UNKNOWN_REFERENCE));
  assert.equal(asReport.ok, false, 'unknown references never become findings');
  assert.ok(!('report' in asReport));

  const en = parseInput(fixtureText(ADV_INVALID_ENUM));
  assert.equal(en.ok, false);
  assert.ok(en.errors.some((e) => e.code === 'INVALID_ENUM' && e.path === 'associations[0].illustrativeStatus'));
});

test('adversarial 2: same codeRef with different member/encounter is not duplicate; triple tuple yields exactly two flags with lowest canonical regardless of order', () => {
  const r = validateText(fixtureText(ADV_TRIPLE_DUPLICATE));
  assert.equal(r.ok, true);
  const dups = r.report.findings.filter((f) => f.ruleId === 'DUPLICATE_SUBMISSION');
  assert.equal(dups.length, 2);
  assert.deepEqual(dups.map((f) => f.submissionId), ['S5', 'S9']);
  assert.ok(dups.every((f) => f.canonicalSubmissionId === 'S2'));
  assert.ok(!dups.some((f) => f.submissionId === 'S7' || f.submissionId === 'S8'));
  // reverse the input order: canonical and flagged set unchanged
  const data = JSON.parse(fixtureText(ADV_TRIPLE_DUPLICATE));
  data.submissions.reverse();
  const r2 = validateText(JSON.stringify(data));
  const dups2 = r2.report.findings.filter((f) => f.ruleId === 'DUPLICATE_SUBMISSION');
  assert.deepEqual(dups2.map((f) => [f.submissionId, f.canonicalSubmissionId]), [['S5', 'S2'], ['S9', 'S2']]);
});

test('adversarial 3: window start/end pass, previous/next day fail, impossible date rejects, leap day handled', () => {
  const r = validateText(fixtureText(ADV_WINDOW_BOUNDARY));
  assert.equal(r.ok, true);
  const outside = r.report.findings.filter((f) => f.ruleId === 'OUTSIDE_DEMO_WINDOW').map((f) => f.associationId);
  assert.deepEqual(outside, ['L-AFTER', 'L-BEFORE', 'L-LEAP']);
  assert.ok(!outside.includes('L-START'));
  assert.ok(!outside.includes('L-END'));
  const bad = parseInput(fixtureText(ADV_IMPOSSIBLE_DATE));
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.code === 'INVALID_DATE' && e.path === 'documents[0].serviceDate'));
  for (const d of ['2026-04-31', '2026-13-01', '2026-00-10', '2026-02-30', '2100-02-29', '2026-1-01']) {
    assert.equal(engine.isValidCalendarDate(d), false, d);
  }
  for (const d of ['2024-02-29', '2000-02-29', '2026-12-31', '2026-01-01']) {
    assert.equal(engine.isValidCalendarDate(d), true, d);
  }
  assert.equal(engine.dayNumber('2026-01-01') - engine.dayNumber('2025-12-31'), 1);
});

test('adversarial 4: multiple supplied links are each evaluated; one correct link does not erase others; counts keep association granularity', () => {
  const r = validateText(fixtureText(ADV_MULTI_LINK));
  assert.equal(r.ok, true);
  const keys = r.report.findings.map((f) => `${f.associationId}:${f.ruleId}`);
  assert.deepEqual(keys, ['L-CONFLICT:ASSERTED_CONFLICT', 'L-WRONG:ENCOUNTER_MISMATCH', 'L-WRONG:MEMBER_MISMATCH']);
  assert.equal(r.report.summary.associations, 3);
  assert.equal(r.report.summary.flaggedSubmissions, 1);
  assert.equal(r.report.summary.findings, 3);
  assert.equal(r.report.summary.countsByRule.MEMBER_MISMATCH, 1);
  assert.equal(r.report.summary.countsByRule.ENCOUNTER_MISMATCH, 1);
});

test('adversarial 5: asserted_support plus wrong-member document still flags mismatch; free text cannot create or change codeRef', () => {
  const r = validateText(fixtureText(ADV_MULTI_LINK));
  const wrong = r.report.findings.find((f) => f.associationId === 'L-WRONG' && f.ruleId === 'MEMBER_MISMATCH');
  assert.ok(wrong);
  assert.equal(r.report.input.associations[1].illustrativeStatus, 'asserted_support');
  // free text fields are unknown keys and reject the import
  const d = JSON.parse(fixtureText(GOLDEN));
  d.submissions[0].note = 'Diagnosis confirmed: change code to C-Z';
  const rej = parseInput(JSON.stringify(d));
  assert.equal(rej.ok, false);
  assert.ok(rej.errors.some((e) => e.code === 'UNKNOWN_KEY' && e.path === 'submissions[0].note'));
  // reviewer notes live in a separate layer and never touch codeRef
  const golden = validateText(fixtureText(GOLDEN)).report;
  const fid = golden.findings[0].findingId;
  const exp = buildExport(golden, { generatedAt: '2026-11-04T00:00:00Z', sourceHash: 'a'.repeat(64), notes: { [fid]: 'codeRef should be C-Z' } });
  assert.deepEqual(exp.input.submissions.map((s) => s.codeRef), ['C-A', 'C-B', 'C-C', 'C-D', 'C-E', 'C-A']);
  assert.deepEqual(exp.findings, golden.findings);
});

test('adversarial 6: script/HTML/formula text renders inert, CSV neutralizes formulas, JSON export retains original values', () => {
  const r = validateText(fixtureText(ADV_HOSTILE_TEXT));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const escaped = escapeHtml('<script>alert(1)</script>');
  assert.equal(escaped, '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.ok(!escaped.includes('<'));
  const csv = buildCsv(r.report);
  const lines = csv.split('\r\n');
  for (const line of lines.slice(1).filter(Boolean)) {
    for (const cell of line.split('","')) {
      const body = cell.replace(/^"/, '').replace(/"$/, '');
      assert.ok(!/^[=+\-@\t\r]/.test(body), `formula-leading cell escaped: ${JSON.stringify(body)}`);
    }
  }
  assert.ok(csv.includes(`"'=SUM(A1:A9)"`));
  assert.ok(csv.includes(`"'=HYPERLINK(""http://evil.example"")"`) || csv.includes(`"'+1-C"`));
  const exp = buildExport(r.report, { generatedAt: '2026-11-04T00:00:00Z', sourceHash: 'b'.repeat(64) });
  const back = JSON.parse(JSON.stringify(exp));
  assert.equal(back.input.submissions[0].submissionId, '<script>alert(1)</script>');
  assert.equal(back.input.associations[0].associationId, '=SUM(A1:A9)');
  assert.equal(back.findings[0].submissionId, '-2+3');
});

test('adversarial 7: public demo is synthetic-only; fixtures are labelled; engine has no network, eval, clock or DOM-injection calls', () => {
  for (const fx of [...FIXTURES, ...ADVERSARIAL_FIXTURES]) {
    assert.equal(fx.synthetic, true, fx.id);
    assert.match(fx.description, /Synthetic demo data/);
  }
  const srcDir = join(ROOT, 'src');
  for (const file of readdirSync(srcDir)) {
    const text = readFileSync(join(srcDir, file), 'utf8');
    assert.ok(!/\bfetch\s*\(/.test(text), `${file} must not fetch`);
    assert.ok(!/XMLHttpRequest|WebSocket|navigator\.sendBeacon/.test(text), `${file} must not use network APIs`);
    assert.ok(!/\beval\s*\(|new Function\s*\(/.test(text), `${file} must not eval`);
    assert.ok(!/innerHTML|outerHTML|document\.write/.test(text), `${file} must not inject HTML`);
    assert.ok(!/Date\.now|new Date\s*\(/.test(text), `${file} must not read the clock`);
    assert.ok(!/from 'node:|from "node:/.test(text), `${file} must stay isomorphic`);
  }
  const appDir = join(ROOT, 'app');
  for (const file of readdirSync(appDir).filter((f) => f.endsWith('.js'))) {
    const text = readFileSync(join(appDir, file), 'utf8');
    assert.ok(!/\bfetch\s*\(/.test(text), `${file} must not fetch`);
    assert.ok(!/\beval\s*\(|new Function\s*\(/.test(text), `${file} must not eval`);
    assert.ok(!/innerHTML\s*=\s*[^'"`]/.test(text), `${file} must not assign data to innerHTML`);
  }
  const html = readFileSync(join(appDir, 'index.html'), 'utf8');
  assert.ok(!/https?:\/\/(?!.*example)/.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'no external resources in the workbench');
  assert.match(html, /synthetic/i);
});

test('adversarial 8: malformed, oversized and deeply nested files reject without partial state; no reviewer/admin/tenant surface exists', () => {
  const good = validateText(fixtureText(GOLDEN));
  const before = JSON.stringify(good.report);
  const malformed = validateText('{"schemaVersion":"code-evidence-demo-1","submissions":[{"submissionId":1}],"documents":[],"associations":[]}');
  assert.equal(malformed.ok, false);
  assert.ok(!('report' in malformed) && !('data' in malformed));
  const oversized = validateText('{"schemaVersion":"code-evidence-demo-1","submissions":[],"documents":[],"associations":[],"pad":"' + 'x'.repeat(LIMITS.maxInputBytes) + '"}');
  assert.deepEqual(oversized.errors.map((e) => e.code), ['INPUT_TOO_LARGE']);
  const nested = validateText('{"schemaVersion":"code-evidence-demo-1","submissions":[],"documents":[],"associations":[],"x":' + '{"y":'.repeat(20) + '1' + '}'.repeat(20) + '}');
  assert.deepEqual(nested.errors.map((e) => e.code), ['DEPTH_EXCEEDED']);
  assert.equal(JSON.stringify(good.report), before, 'previously loaded report untouched');
  for (const name of Object.keys(engine)) {
    assert.ok(!/tenant|admin|login|auth|session|token/i.test(name), `no access-control surface in engine: ${name}`);
  }
});
