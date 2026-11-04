import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterFindings, formatDate, summaryRows, decisionLabel, citedRecords, escapeHtml, csvCell, bytesToHex } from '../app/ui.js';
import { validateText } from '../src/index.js';
import { GOLDEN, fixtureText } from '../fixtures/index.js';

const report = validateText(fixtureText(GOLDEN)).report;

test('ui helpers: filterFindings by rule, text and missing-association filter', () => {
  assert.equal(filterFindings(report.findings).length, 6);
  assert.deepEqual(filterFindings(report.findings, { ruleId: 'MEMBER_MISMATCH' }).map((f) => f.submissionId), ['S3']);
  assert.deepEqual(filterFindings(report.findings, { missingAssociationOnly: true }).map((f) => f.submissionId), ['S2']);
  assert.deepEqual(filterFindings(report.findings, { query: 's4' }).map((f) => f.ruleId), ['OUTSIDE_DEMO_WINDOW', 'SIGNATURE_METADATA_MISSING']);
  assert.deepEqual(filterFindings(report.findings, { query: 'L5' }).map((f) => f.ruleId), ['ASSERTED_CONFLICT']);
  assert.deepEqual(filterFindings(report.findings, { query: 'S1' }).map((f) => f.submissionId), ['S6'], 'canonical ID is searchable');
  assert.deepEqual(filterFindings(report.findings, { ruleId: 'NO_ASSOCIATION', query: 'S3' }), []);
});

test('ui helpers: formatDate, summaryRows, decisionLabel, citedRecords, escapeHtml, csvCell, bytesToHex', () => {
  assert.equal(formatDate('2026-03-01'), '01 Mar 2026 (2026-03-01)');
  assert.equal(formatDate('2026-02-30'), 'invalid date');
  assert.deepEqual(summaryRows(report.summary), [
    ['Submissions', 6],
    ['Documents', 4],
    ['Associations', 5],
    ['Flagged submissions', 5],
    ['Structurally consistent submissions', 1],
    ['Findings', 6],
  ]);
  assert.equal(decisionLabel('deferred'), 'Deferred');
  assert.equal(decisionLabel('<x>'), '<x>');
  const s4 = report.findings.find((f) => f.submissionId === 'S4');
  const cited = citedRecords(report, s4);
  assert.equal(cited.document.serviceDate, '2025-12-31');
  assert.equal(cited.document.signatureMetadataPresent, false);
  assert.equal(cited.association.associationId, 'L4');
  const s6 = report.findings.find((f) => f.submissionId === 'S6');
  assert.equal(citedRecords(report, s6).canonical.submissionId, 'S1');
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(csvCell('=cmd'), `"'=cmd"`);
  assert.equal(bytesToHex(new Uint8Array([0, 255, 16]).buffer), '00ff10');
});
