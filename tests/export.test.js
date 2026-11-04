import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateText, buildExport, buildCsv, serializeExport, assertExportSize, roundtripExport, csvCell, csvRow, escapeHtml, LIMITS, DECISIONS } from '../src/index.js';
import { GOLDEN, fixtureText } from '../fixtures/index.js';

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

function golden() {
  const text = fixtureText(GOLDEN);
  return { text, report: validateText(text).report };
}

test('notes isolation: adding notes and decisions leaves validation output byte-identical and outside findings', () => {
  const { text, report } = golden();
  const before = JSON.stringify(report);
  const fid = report.findings[2].findingId;
  const notes = { [fid]: 'Reviewer: source date 2025-12-31 confirmed in fixture; <b>escalate</b>.' };
  const decisions = { [fid]: 'escalate_to_clinical_review' };
  const exp = buildExport(report, { generatedAt: '2026-11-04T02:00:00Z', sourceHash: sha256(text), notes, decisions });
  assert.equal(JSON.stringify(report), before);
  assert.deepEqual(exp.findings, report.findings);
  assert.ok(!('note' in exp.findings[2]) && !('decision' in exp.findings[2]));
  assert.deepEqual(exp.notes, notes);
  assert.deepEqual(exp.decisions, decisions);
  assert.equal(exp.findings.length, 6, 'original finding never removed by disposition');
  assert.equal(escapeHtml(notes[fid]), 'Reviewer: source date 2025-12-31 confirmed in fixture; &lt;b&gt;escalate&lt;/b&gt;.');
});

test('notes bounds: over-length notes, unknown finding IDs and unknown decisions are rejected', () => {
  const { text, report } = golden();
  const fid = report.findings[0].findingId;
  const args = { generatedAt: 'T', sourceHash: sha256(text) };
  assert.ok(buildExport(report, { ...args, notes: { [fid]: 'x'.repeat(LIMITS.maxNoteLength) } }));
  assert.throws(() => buildExport(report, { ...args, notes: { [fid]: 'x'.repeat(LIMITS.maxNoteLength + 1) } }), (e) => e.code === 'NOTE_TOO_LONG');
  assert.throws(() => buildExport(report, { ...args, notes: { nope: 'x' } }), (e) => e.code === 'EXPORT_UNKNOWN_FINDING');
  assert.throws(() => buildExport(report, { ...args, decisions: { [fid]: 'clinically_supported' } }), (e) => e.code === 'EXPORT_INVALID_DECISION');
  assert.throws(() => buildExport(report, { ...args, notes: [] }), (e) => e.code === 'EXPORT_INVALID_ARGUMENT');
  assert.ok(!DECISIONS.some((d) => /clinically_supported/.test(d)));
});

test('export roundtrip: stringify + reparse deep-equals live findings and summary; carries required fields', () => {
  const { text, report } = golden();
  const hash = sha256(text);
  const exp = buildExport(report, { generatedAt: '2026-11-04T02:00:00.000Z', sourceHash: hash });
  const back = roundtripExport(exp);
  assert.deepEqual(back.findings, report.findings);
  assert.deepEqual(back.summary, report.summary);
  assert.deepEqual(back.input, report.input);
  assert.equal(back.schemaVersion, 'code-evidence-demo-1');
  assert.equal(back.ruleVersion, 'ce-structural-1');
  assert.equal(back.rulePack.provenance.kind, 'fictional-demo-configuration');
  assert.equal(back.synthetic, true);
  assert.match(back.syntheticLabel, /SYNTHETIC DEMO DATA/);
  assert.equal(back.generatedAt, '2026-11-04T02:00:00.000Z');
  assert.equal(back.sourceHash, hash);
  assert.equal(hash.length, 64);
  const serialized = serializeExport(exp);
  assert.deepEqual(JSON.parse(serialized).findings, report.findings);
});

test('export guards: generatedAt and sourceHash are caller-supplied and validated; 10 MiB limit enforced in memory', () => {
  const { report } = golden();
  assert.throws(() => buildExport(report, { sourceHash: 'a'.repeat(64) }), (e) => e.code === 'EXPORT_INVALID_ARGUMENT');
  assert.throws(() => buildExport(report, { generatedAt: 'T', sourceHash: 'nothex' }), (e) => e.code === 'EXPORT_INVALID_ARGUMENT');
  assert.throws(() => buildExport({}, { generatedAt: 'T', sourceHash: 'a'.repeat(64) }), (e) => e.code === 'EXPORT_INVALID_ARGUMENT');
  const big = 'x'.repeat(LIMITS.maxExportBytes + 1);
  assert.throws(() => assertExportSize(big), (e) => e.code === 'EXPORT_TOO_LARGE');
  assert.equal(assertExportSize('x'.repeat(LIMITS.maxExportBytes)), LIMITS.maxExportBytes);
});

test('csv: RFC 4180 quoting, CRLF rows, formula neutralization for = + - @ tab CR', () => {
  assert.equal(csvCell('plain'), '"plain"');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=1+1'), `"'=1+1"`);
  assert.equal(csvCell('+1'), `"'+1"`);
  assert.equal(csvCell('-1'), `"'-1"`);
  assert.equal(csvCell('@cmd'), `"'@cmd"`);
  assert.equal(csvCell('\tx'), `"'\tx"`);
  assert.equal(csvCell('\rx'), `"'\rx"`);
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(7), '"7"');
  assert.equal(csvRow(['a', 'b']), '"a","b"');
  const { report } = golden();
  const csv = buildCsv(report, { notes: { [report.findings[0].findingId]: '=HYPERLINK("x")' }, decisions: { [report.findings[0].findingId]: 'deferred' } });
  const lines = csv.split('\r\n');
  // Header corrected in the 2026-11-04 resume session: adversarial test 6 (spec clause 6, safe CSV with the
  // fixture's formula-leading memberId/codeRef) requires finding rows to carry the cited original values.
  assert.equal(
    lines[0],
    csvRow([
      'findingId', 'ruleId', 'ruleVersion', 'level',
      'submissionId', 'memberId', 'encounterId', 'codeRef',
      'associationId', 'illustrativeStatus',
      'documentId', 'documentMemberId', 'documentEncounterId', 'serviceDate', 'signatureMetadataPresent',
      'canonicalSubmissionId', 'message', 'decision', 'note', 'dataLabel',
    ]),
  );
  assert.equal(lines.length, 1 + 6 + 1);
  // S2 NO_ASSOCIATION row: cited submission tuple present, no association/document values
  assert.ok(lines[1].includes('"S2","M2","E2","C-B","","","","","","",""'));
  // S4 OUTSIDE_DEMO_WINDOW row carries the original source date and signature flag
  assert.ok(lines[3].includes('"L4","unreviewed","D3","M4","E4","2025-12-31","false"'));
  assert.ok(lines[1].includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(lines[1].includes('"deferred"'));
  assert.ok(lines[1].endsWith('"synthetic demo data"'));
});
