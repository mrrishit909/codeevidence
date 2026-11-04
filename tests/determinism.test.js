import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateText, runValidation, buildExport } from '../src/index.js';
import { GOLDEN, ADV_TRIPLE_DUPLICATE, ADV_MULTI_LINK, fixtureText } from '../fixtures/index.js';

// Deterministic seeded shuffle (mulberry32) so the test itself is reproducible.
function shuffle(arr, seed) {
  let t = seed >>> 0;
  const rand = () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function stripInput(report) {
  const { input, ...rest } = report;
  return rest;
}

test('determinism: shuffling input arrays does not change findings or summary', () => {
  for (const fx of [GOLDEN, ADV_TRIPLE_DUPLICATE, ADV_MULTI_LINK]) {
    const base = validateText(fixtureText(fx)).report;
    for (let seed = 1; seed <= 5; seed += 1) {
      const data = JSON.parse(fixtureText(fx));
      data.submissions = shuffle(data.submissions, seed);
      data.documents = shuffle(data.documents, seed + 100);
      data.associations = shuffle(data.associations, seed + 200);
      const shuffled = runValidation(data);
      assert.deepEqual(shuffled.findings, base.findings, `${fx.id} seed ${seed}`);
      assert.deepEqual(shuffled.summary, base.summary);
      assert.equal(JSON.stringify(stripInput(shuffled)), JSON.stringify(stripInput(base)));
      // input snapshot preserves the caller's own order untouched
      assert.deepEqual(shuffled.input, data);
    }
  }
});

test('determinism: running twice yields byte-identical reports and stable finding IDs', () => {
  const a = validateText(fixtureText(GOLDEN)).report;
  const b = validateText(fixtureText(GOLDEN)).report;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual(
    a.findings.map((f) => f.findingId),
    ['NO_ASSOCIATION|S2|', 'MEMBER_MISMATCH|S3|L3', 'OUTSIDE_DEMO_WINDOW|S4|L4', 'SIGNATURE_METADATA_MISSING|S4|L4', 'ASSERTED_CONFLICT|S5|L5', 'DUPLICATE_SUBMISSION|S6|'],
  );
  const ids = new Set(a.findings.map((f) => f.findingId));
  assert.equal(ids.size, a.findings.length);
  const e1 = buildExport(a, { generatedAt: 'T', sourceHash: '0'.repeat(64) });
  const e2 = buildExport(b, { generatedAt: 'T', sourceHash: '0'.repeat(64) });
  assert.equal(JSON.stringify(e1), JSON.stringify(e2));
});
