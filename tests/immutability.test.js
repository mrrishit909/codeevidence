import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateText, RULE_PACK, checkedAdd, checkedSubtract, IntegerError } from '../src/index.js';
import { GOLDEN, fixtureText } from '../fixtures/index.js';

test('immutability: report, findings, summary and input snapshot are deep-frozen; mutation throws in strict mode', () => {
  const { report } = validateText(fixtureText(GOLDEN));
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.findings));
  assert.ok(Object.isFrozen(report.findings[0]));
  assert.ok(Object.isFrozen(report.findings[0].details));
  assert.ok(Object.isFrozen(report.summary.countsByRule));
  assert.ok(Object.isFrozen(report.input.submissions[0]));
  assert.throws(() => {
    report.summary.findings = 0;
  }, TypeError);
  assert.throws(() => {
    report.findings.push({});
  }, TypeError);
  assert.throws(() => {
    report.findings[0].ruleId = 'X';
  }, TypeError);
  assert.throws(() => {
    report.input.submissions[0].codeRef = 'C-Z';
  }, TypeError);
  assert.throws(() => {
    delete report.summary.submissions;
  }, TypeError);
  assert.equal(report.summary.findings, 6);
});

test('immutability: rule pack and fixtures are frozen', () => {
  assert.ok(Object.isFrozen(RULE_PACK.rules.NO_ASSOCIATION));
  assert.throws(() => {
    RULE_PACK.window.start = '2000-01-01';
  }, TypeError);
  assert.throws(() => {
    GOLDEN.data.submissions[0].codeRef = 'C-Z';
  }, TypeError);
});

test('checked integers: overflow and invalid operands reject with explicit codes', () => {
  assert.equal(checkedAdd(1, 2), 3);
  assert.equal(checkedAdd(Number.MAX_SAFE_INTEGER - 1, 1), Number.MAX_SAFE_INTEGER);
  assert.throws(() => checkedAdd(Number.MAX_SAFE_INTEGER, 1), (e) => e instanceof IntegerError && e.code === 'INTEGER_OVERFLOW');
  assert.throws(() => checkedAdd(1, -1), (e) => e.code === 'INTEGER_INVALID');
  assert.throws(() => checkedAdd(1.5, 1), (e) => e.code === 'INTEGER_INVALID');
  assert.throws(() => checkedAdd(NaN, 1), (e) => e.code === 'INTEGER_INVALID');
  assert.throws(() => checkedAdd(1, Infinity), (e) => e.code === 'INTEGER_INVALID');
  assert.throws(() => checkedAdd('1', 1), (e) => e.code === 'INTEGER_INVALID');
  assert.equal(checkedSubtract(5, 2), 3);
  assert.throws(() => checkedSubtract(2, 5), (e) => e.code === 'INTEGER_INVALID');
});
