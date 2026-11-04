import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, validateDataset, LIMITS, utf8ByteLength, measureDepth } from '../src/index.js';
import { GOLDEN, fixtureText } from '../fixtures/index.js';

function clone(fx) {
  return JSON.parse(fixtureText(fx));
}
function codes(result) {
  return result.errors.map((e) => e.code);
}

test('schema: golden fixture parses', () => {
  const r = parseInput(fixtureText(GOLDEN));
  assert.equal(r.ok, true);
  assert.equal(r.data.submissions.length, 6);
});

test('schema: non-string input, invalid JSON and non-object roots reject without data', () => {
  for (const bad of [42, null, undefined, {}]) {
    const r = parseInput(bad);
    assert.equal(r.ok, false);
    assert.ok(!('data' in r));
  }
  assert.deepEqual(codes(parseInput('{not json')), ['INVALID_JSON']);
  assert.deepEqual(codes(parseInput('[]')), ['ROOT_NOT_OBJECT']);
  assert.deepEqual(codes(parseInput('null')), ['ROOT_NOT_OBJECT']);
  assert.deepEqual(codes(parseInput('"str"')), ['ROOT_NOT_OBJECT']);
});

test('schema: unknown schemaVersion and ruleVersion reject', () => {
  const d = clone(GOLDEN);
  d.schemaVersion = 'code-evidence-demo-2';
  assert.ok(codes(parseInput(JSON.stringify(d))).includes('UNKNOWN_SCHEMA_VERSION'));
  const d2 = clone(GOLDEN);
  d2.ruleVersion = 'ce-structural-2';
  assert.ok(codes(parseInput(JSON.stringify(d2))).includes('UNKNOWN_RULE_VERSION'));
  const d3 = clone(GOLDEN);
  delete d3.schemaVersion;
  assert.ok(codes(parseInput(JSON.stringify(d3))).includes('UNKNOWN_SCHEMA_VERSION'));
});

test('schema: missing required arrays, wrong types and unknown keys reject with paths', () => {
  const d = clone(GOLDEN);
  delete d.documents;
  const r = parseInput(JSON.stringify(d));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'MISSING_REQUIRED' && e.path === 'documents'));

  const d2 = clone(GOLDEN);
  d2.submissions = {};
  assert.ok(parseInput(JSON.stringify(d2)).errors.some((e) => e.code === 'WRONG_TYPE' && e.path === 'submissions'));

  const d3 = clone(GOLDEN);
  d3.extra = 1;
  assert.ok(parseInput(JSON.stringify(d3)).errors.some((e) => e.code === 'UNKNOWN_KEY' && e.path === 'extra'));

  const d4 = clone(GOLDEN);
  d4.submissions[2].diagnosisText = 'free text';
  const r4 = parseInput(JSON.stringify(d4));
  assert.ok(r4.errors.some((e) => e.code === 'UNKNOWN_KEY' && e.path === 'submissions[2].diagnosisText'));

  const d5 = clone(GOLDEN);
  delete d5.associations[1].documentId;
  assert.ok(parseInput(JSON.stringify(d5)).errors.some((e) => e.code === 'MISSING_REQUIRED' && e.path === 'associations[1].documentId'));

  const d6 = clone(GOLDEN);
  d6.submissions[0] = 'S1';
  assert.ok(parseInput(JSON.stringify(d6)).errors.some((e) => e.code === 'WRONG_TYPE' && e.path === 'submissions[0]'));
});

test('schema: field types are strict (boolean, string, enum, date)', () => {
  const d = clone(GOLDEN);
  d.documents[0].signatureMetadataPresent = 'true';
  assert.ok(parseInput(JSON.stringify(d)).errors.some((e) => e.code === 'WRONG_TYPE' && e.path === 'documents[0].signatureMetadataPresent'));
  const d2 = clone(GOLDEN);
  d2.documents[0].signatureMetadataPresent = 1;
  assert.ok(parseInput(JSON.stringify(d2)).errors.some((e) => e.path === 'documents[0].signatureMetadataPresent'));
  const d3 = clone(GOLDEN);
  d3.submissions[0].codeRef = 12;
  assert.ok(parseInput(JSON.stringify(d3)).errors.some((e) => e.code === 'WRONG_TYPE' && e.path === 'submissions[0].codeRef'));
  const d4 = clone(GOLDEN);
  d4.submissions[0].codeRef = '';
  assert.ok(parseInput(JSON.stringify(d4)).errors.some((e) => e.code === 'EMPTY_STRING'));
  const d5 = clone(GOLDEN);
  d5.documents[1].serviceDate = '2026-3-02';
  assert.ok(parseInput(JSON.stringify(d5)).errors.some((e) => e.code === 'INVALID_DATE' && e.path === 'documents[1].serviceDate'));
  const d6 = clone(GOLDEN);
  d6.documents[1].serviceDate = 20260302;
  assert.ok(parseInput(JSON.stringify(d6)).errors.some((e) => e.code === 'WRONG_TYPE' && e.path === 'documents[1].serviceDate'));
});

test('schema: 200-character ID bound is enforced on every identifier field', () => {
  const ok = clone(GOLDEN);
  ok.submissions[0].codeRef = 'x'.repeat(200);
  assert.equal(parseInput(JSON.stringify(ok)).ok, true);
  for (const [arr, idx, key] of [
    ['submissions', 0, 'submissionId'],
    ['submissions', 0, 'memberId'],
    ['submissions', 0, 'encounterId'],
    ['submissions', 0, 'codeRef'],
    ['documents', 0, 'documentId'],
    ['documents', 0, 'memberId'],
    ['documents', 0, 'encounterId'],
    ['associations', 0, 'associationId'],
  ]) {
    const d = clone(GOLDEN);
    d[arr][idx][key] = 'x'.repeat(201);
    const r = parseInput(JSON.stringify(d));
    assert.equal(r.ok, false, `${arr}[${idx}].${key}`);
    assert.ok(r.errors.some((e) => e.code === 'STRING_TOO_LONG' && e.path === `${arr}[${idx}].${key}`));
  }
});

test('schema: row limits reject (built in memory)', () => {
  const d = { schemaVersion: 'code-evidence-demo-1', submissions: [], documents: [], associations: [] };
  for (let i = 0; i < LIMITS.maxSubmissions + 1; i += 1) {
    d.submissions.push({ submissionId: `S${i}`, memberId: 'M', encounterId: 'E', codeRef: 'C' });
  }
  const r = parseInput(JSON.stringify(d));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'TOO_MANY_ROWS' && e.path === 'submissions'));
  d.submissions.pop();
  assert.equal(parseInput(JSON.stringify(d)).ok, true);
  const docs = { schemaVersion: 'code-evidence-demo-1', submissions: [], documents: new Array(LIMITS.maxDocuments + 1).fill(0), associations: [] };
  assert.ok(parseInput(JSON.stringify(docs)).errors.some((e) => e.code === 'TOO_MANY_ROWS' && e.path === 'documents'));
  const links = { schemaVersion: 'code-evidence-demo-1', submissions: [], documents: [], associations: new Array(LIMITS.maxAssociations + 1).fill(0) };
  assert.ok(parseInput(JSON.stringify(links)).errors.some((e) => e.code === 'TOO_MANY_ROWS' && e.path === 'associations'));
});

test('schema: input over 1 MiB (UTF-8 bytes) rejects before parsing', () => {
  const pad = 'é'.repeat(LIMITS.maxInputBytes / 2 + 1); // 2 bytes each -> over limit, fewer characters than limit
  assert.ok(pad.length < LIMITS.maxInputBytes);
  assert.ok(utf8ByteLength(pad) > LIMITS.maxInputBytes);
  const r = parseInput(pad);
  assert.deepEqual(codes(r), ['INPUT_TOO_LARGE']);
  const exact = '"' + 'a'.repeat(LIMITS.maxInputBytes - 2) + '"';
  assert.equal(utf8ByteLength(exact), LIMITS.maxInputBytes);
  assert.deepEqual(codes(parseInput(exact)), ['ROOT_NOT_OBJECT']);
});

test('schema: nesting depth over 8 rejects', () => {
  assert.equal(measureDepth({ a: [{ b: 1 }] }, 8), 3);
  const deep = '{"schemaVersion":"code-evidence-demo-1","submissions":[],"documents":[],"associations":[],"x":' + '['.repeat(9) + ']'.repeat(9) + '}';
  assert.deepEqual(codes(parseInput(deep)), ['DEPTH_EXCEEDED']);
  const okDepth = '{"schemaVersion":"code-evidence-demo-1","submissions":[],"documents":[],"associations":[]}';
  assert.equal(parseInput(okDepth).ok, true);
});

test('schema: NaN/Infinity cannot enter via JSON and numeric strings are not accepted as booleans', () => {
  assert.deepEqual(codes(parseInput('{"a": NaN}')), ['INVALID_JSON']);
  assert.deepEqual(codes(parseInput('{"a": Infinity}')), ['INVALID_JSON']);
});

test('schema: validateDataset on a non-object returns ROOT_NOT_OBJECT', () => {
  assert.deepEqual(validateDataset([]).map((e) => e.code), ['ROOT_NOT_OBJECT']);
});
