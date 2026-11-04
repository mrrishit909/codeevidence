import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateText, RULE_IDS } from '../src/index.js';
import { GOLDEN, CLEAN, EMPTY, fixtureText } from '../fixtures/index.js';

function run(fx) {
  const r = validateText(fixtureText(fx));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.report;
}

test('golden oracle: summary counts match the spec literally', () => {
  const { summary } = run(GOLDEN);
  assert.equal(summary.submissions, 6);
  assert.equal(summary.documents, 4);
  assert.equal(summary.associations, 5);
  assert.equal(summary.flaggedSubmissions, 5);
  assert.equal(summary.structurallyConsistentSubmissions, 1);
  assert.equal(summary.findings, 6);
  assert.deepEqual(summary.countsByRule, {
    ASSERTED_CONFLICT: 1,
    DUPLICATE_SUBMISSION: 1,
    ENCOUNTER_MISMATCH: 0,
    MEMBER_MISMATCH: 1,
    NO_ASSOCIATION: 1,
    OUTSIDE_DEMO_WINDOW: 1,
    SIGNATURE_METADATA_MISSING: 1,
  });
  assert.deepEqual(Object.keys(summary.countsByRule), [...RULE_IDS]);
  assert.equal(summary.structurallyConsistentLabel, 'structurally consistent, human clinical review required');
});

test('golden oracle: per-submission expected findings and canonical duplicate', () => {
  const { findings } = run(GOLDEN);
  const bySub = (id) => findings.filter((f) => f.submissionId === id).map((f) => [f.ruleId, f.associationId]);
  assert.deepEqual(bySub('S1'), []);
  assert.deepEqual(bySub('S2'), [['NO_ASSOCIATION', '']]);
  assert.deepEqual(bySub('S3'), [['MEMBER_MISMATCH', 'L3']]);
  assert.deepEqual(bySub('S4'), [
    ['OUTSIDE_DEMO_WINDOW', 'L4'],
    ['SIGNATURE_METADATA_MISSING', 'L4'],
  ]);
  assert.deepEqual(bySub('S5'), [['ASSERTED_CONFLICT', 'L5']]);
  assert.deepEqual(bySub('S6'), [['DUPLICATE_SUBMISSION', '']]);
  const dup = findings.find((f) => f.ruleId === 'DUPLICATE_SUBMISSION');
  assert.equal(dup.canonicalSubmissionId, 'S1');
  assert.equal(dup.ruleVersion, 'ce-structural-1');
});

test('golden oracle: findings sorted by (submissionId, associationId-or-empty, ruleId)', () => {
  const { findings } = run(GOLDEN);
  const keys = findings.map((f) => `${f.submissionId}|${f.associationId}|${f.ruleId}`);
  assert.deepEqual(keys, [
    'S2||NO_ASSOCIATION',
    'S3|L3|MEMBER_MISMATCH',
    'S4|L4|OUTSIDE_DEMO_WINDOW',
    'S4|L4|SIGNATURE_METADATA_MISSING',
    'S5|L5|ASSERTED_CONFLICT',
    'S6||DUPLICATE_SUBMISSION',
  ]);
});

test('golden oracle: report carries schema, rule version, provenance, synthetic label and untouched input', () => {
  const report = run(GOLDEN);
  assert.equal(report.schemaVersion, 'code-evidence-demo-1');
  assert.equal(report.ruleVersion, 'ce-structural-1');
  assert.equal(report.rulePack.provenance.kind, 'fictional-demo-configuration');
  assert.match(report.rulePack.provenance.source, /CODEEVIDENCE-VERTICAL-SLICE\.md/);
  assert.equal(report.synthetic, true);
  assert.deepEqual(report.input, GOLDEN.data);
  assert.deepEqual(report.rulePack.window, { start: '2026-01-01', end: '2026-12-31' });
  const text = JSON.stringify(report).toLowerCase();
  assert.ok(!text.includes('clinically supported'));
  assert.ok(!('totals' in report.summary), 'no financial totals');
});

test('clean variant: zero findings reads structurally consistent, never clinically supported', () => {
  const report = run(CLEAN);
  assert.equal(report.summary.findings, 0);
  assert.equal(report.summary.flaggedSubmissions, 0);
  assert.equal(report.summary.structurallyConsistentSubmissions, 3);
  assert.deepEqual(report.findings, []);
  assert.match(report.disclaimer, /human clinical review required/);
  assert.ok(!JSON.stringify(report).toLowerCase().includes('clinically supported'));
  for (const ruleId of RULE_IDS) assert.equal(report.summary.countsByRule[ruleId], 0);
});

test('empty fixture: valid envelope yields zero counts', () => {
  const report = run(EMPTY);
  assert.equal(report.summary.submissions, 0);
  assert.equal(report.summary.structurallyConsistentSubmissions, 0);
  assert.equal(report.findings.length, 0);
});
