// Labelled SYNTHETIC fixtures: the single source of truth for tests and the workbench UI.
// Every member, encounter, document and code reference here is fictitious demo data.

import { deepFreeze } from '../src/freeze.js';

const SCHEMA = 'code-evidence-demo-1';
const NOTICE = 'Synthetic demo data. Fictitious members, encounters, documents and code references. Not real records.';

function fixture(id, title, description, data) {
  return deepFreeze({ id, title, synthetic: true, description: `${description} ${NOTICE}`, data });
}

export function fixtureText(fx) {
  return JSON.stringify(fx.data, null, 2);
}

// Exact golden fixture from CODEEVIDENCE-VERTICAL-SLICE.md
export const GOLDEN = fixture('golden', 'Golden fixture (6 submissions, 5 links)', 'Spec golden fixture: one clean submission, one missing association, one member mismatch, one window + signature case, one asserted conflict, one duplicate.', {
  schemaVersion: SCHEMA,
  ruleVersion: 'ce-structural-1',
  documents: [
    { documentId: 'D1', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-03-01', signatureMetadataPresent: true },
    { documentId: 'D2', memberId: 'M9', encounterId: 'E3', serviceDate: '2026-03-02', signatureMetadataPresent: true },
    { documentId: 'D3', memberId: 'M4', encounterId: 'E4', serviceDate: '2025-12-31', signatureMetadataPresent: false },
    { documentId: 'D4', memberId: 'M5', encounterId: 'E5', serviceDate: '2026-06-01', signatureMetadataPresent: true },
  ],
  submissions: [
    { submissionId: 'S1', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' },
    { submissionId: 'S2', memberId: 'M2', encounterId: 'E2', codeRef: 'C-B' },
    { submissionId: 'S3', memberId: 'M3', encounterId: 'E3', codeRef: 'C-C' },
    { submissionId: 'S4', memberId: 'M4', encounterId: 'E4', codeRef: 'C-D' },
    { submissionId: 'S5', memberId: 'M5', encounterId: 'E5', codeRef: 'C-E' },
    { submissionId: 'S6', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' },
  ],
  associations: [
    { associationId: 'L1', submissionId: 'S1', documentId: 'D1', illustrativeStatus: 'asserted_support' },
    { associationId: 'L3', submissionId: 'S3', documentId: 'D2', illustrativeStatus: 'unreviewed' },
    { associationId: 'L4', submissionId: 'S4', documentId: 'D3', illustrativeStatus: 'unreviewed' },
    { associationId: 'L5', submissionId: 'S5', documentId: 'D4', illustrativeStatus: 'asserted_conflict' },
    { associationId: 'L6', submissionId: 'S6', documentId: 'D1', illustrativeStatus: 'asserted_support' },
  ],
});

export const CLEAN = fixture('clean', 'Clean fixture (zero findings)', 'Every submission has one consistent association inside the window with signature metadata present.', {
  schemaVersion: SCHEMA,
  documents: [
    { documentId: 'D1', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-01-01', signatureMetadataPresent: true },
    { documentId: 'D2', memberId: 'M2', encounterId: 'E2', serviceDate: '2026-07-15', signatureMetadataPresent: true },
    { documentId: 'D3', memberId: 'M3', encounterId: 'E3', serviceDate: '2026-12-31', signatureMetadataPresent: true },
  ],
  submissions: [
    { submissionId: 'S1', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' },
    { submissionId: 'S2', memberId: 'M2', encounterId: 'E2', codeRef: 'C-B' },
    { submissionId: 'S3', memberId: 'M3', encounterId: 'E3', codeRef: 'C-A' },
  ],
  associations: [
    { associationId: 'L1', submissionId: 'S1', documentId: 'D1', illustrativeStatus: 'asserted_support' },
    { associationId: 'L2', submissionId: 'S2', documentId: 'D2', illustrativeStatus: 'unreviewed' },
    { associationId: 'L3', submissionId: 'S3', documentId: 'D3', illustrativeStatus: 'asserted_support' },
  ],
});

export const EMPTY = fixture('empty', 'Empty fixture (no records)', 'Valid envelope with no submissions, documents or associations.', {
  schemaVersion: SCHEMA,
  documents: [],
  submissions: [],
  associations: [],
});

// Adversarial case 1: duplicate IDs, unknown references, invalid enum
export const ADV_DUPLICATE_IDS = fixture('adv-duplicate-ids', 'Adversarial: duplicate primary IDs', 'Duplicate submissionId and documentId must reject atomically.', {
  schemaVersion: SCHEMA,
  documents: [
    { documentId: 'D1', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-03-01', signatureMetadataPresent: true },
    { documentId: 'D1', memberId: 'M2', encounterId: 'E2', serviceDate: '2026-03-01', signatureMetadataPresent: true },
  ],
  submissions: [
    { submissionId: 'S1', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' },
    { submissionId: 'S1', memberId: 'M2', encounterId: 'E2', codeRef: 'C-B' },
  ],
  associations: [{ associationId: 'L1', submissionId: 'S1', documentId: 'D1', illustrativeStatus: 'unreviewed' }],
});

export const ADV_UNKNOWN_REFERENCE = fixture('adv-unknown-reference', 'Adversarial: unknown association references', 'Associations pointing at missing submission and document must reject; no silent link repair.', {
  schemaVersion: SCHEMA,
  documents: [{ documentId: 'D1', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-03-01', signatureMetadataPresent: true }],
  submissions: [{ submissionId: 'S1', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' }],
  associations: [
    { associationId: 'L1', submissionId: 'S404', documentId: 'D1', illustrativeStatus: 'unreviewed' },
    { associationId: 'L2', submissionId: 'S1', documentId: 'D404', illustrativeStatus: 'unreviewed' },
  ],
});

export const ADV_INVALID_ENUM = fixture('adv-invalid-enum', 'Adversarial: invalid status enum', 'illustrativeStatus outside the enum must reject.', {
  schemaVersion: SCHEMA,
  documents: [{ documentId: 'D1', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-03-01', signatureMetadataPresent: true }],
  submissions: [{ submissionId: 'S1', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' }],
  associations: [{ associationId: 'L1', submissionId: 'S1', documentId: 'D1', illustrativeStatus: 'clinically_supported' }],
});

// Adversarial case 2: duplicate tuple semantics
export const ADV_TRIPLE_DUPLICATE = fixture('adv-triple-duplicate', 'Adversarial: triple duplicate plus same codeRef elsewhere', 'Three identical tuples yield exactly two later-duplicate flags; same codeRef with a different member is not a duplicate.', {
  schemaVersion: SCHEMA,
  documents: [{ documentId: 'D1', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-03-01', signatureMetadataPresent: true }],
  submissions: [
    { submissionId: 'S9', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' },
    { submissionId: 'S2', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' },
    { submissionId: 'S5', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' },
    { submissionId: 'S7', memberId: 'M2', encounterId: 'E1', codeRef: 'C-A' },
    { submissionId: 'S8', memberId: 'M1', encounterId: 'E2', codeRef: 'C-A' },
  ],
  associations: [
    { associationId: 'L1', submissionId: 'S9', documentId: 'D1', illustrativeStatus: 'unreviewed' },
    { associationId: 'L2', submissionId: 'S2', documentId: 'D1', illustrativeStatus: 'unreviewed' },
    { associationId: 'L3', submissionId: 'S5', documentId: 'D1', illustrativeStatus: 'unreviewed' },
  ],
});

// Adversarial case 3: window boundaries
export const ADV_WINDOW_BOUNDARY = fixture('adv-window-boundary', 'Adversarial: window boundary dates', 'Start and end dates pass; the previous and next calendar days fail.', {
  schemaVersion: SCHEMA,
  documents: [
    { documentId: 'D-START', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-01-01', signatureMetadataPresent: true },
    { documentId: 'D-END', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-12-31', signatureMetadataPresent: true },
    { documentId: 'D-BEFORE', memberId: 'M1', encounterId: 'E1', serviceDate: '2025-12-31', signatureMetadataPresent: true },
    { documentId: 'D-AFTER', memberId: 'M1', encounterId: 'E1', serviceDate: '2027-01-01', signatureMetadataPresent: true },
    { documentId: 'D-LEAP', memberId: 'M1', encounterId: 'E1', serviceDate: '2028-02-29', signatureMetadataPresent: true },
  ],
  submissions: [{ submissionId: 'S1', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' }],
  associations: [
    { associationId: 'L-START', submissionId: 'S1', documentId: 'D-START', illustrativeStatus: 'unreviewed' },
    { associationId: 'L-END', submissionId: 'S1', documentId: 'D-END', illustrativeStatus: 'unreviewed' },
    { associationId: 'L-BEFORE', submissionId: 'S1', documentId: 'D-BEFORE', illustrativeStatus: 'unreviewed' },
    { associationId: 'L-AFTER', submissionId: 'S1', documentId: 'D-AFTER', illustrativeStatus: 'unreviewed' },
    { associationId: 'L-LEAP', submissionId: 'S1', documentId: 'D-LEAP', illustrativeStatus: 'unreviewed' },
  ],
});

export const ADV_IMPOSSIBLE_DATE = fixture('adv-impossible-date', 'Adversarial: impossible calendar date', '2026-02-29 is not a real day (2026 is not a leap year); import must reject.', {
  schemaVersion: SCHEMA,
  documents: [{ documentId: 'D1', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-02-29', signatureMetadataPresent: true }],
  submissions: [{ submissionId: 'S1', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' }],
  associations: [{ associationId: 'L1', submissionId: 'S1', documentId: 'D1', illustrativeStatus: 'unreviewed' }],
});

// Adversarial case 4 and 5: multiple links; asserted_support with wrong member
export const ADV_MULTI_LINK = fixture('adv-multi-link', 'Adversarial: multiple links per submission', 'One correct link plus a wrong-member asserted_support link plus an asserted_conflict link; each is evaluated.', {
  schemaVersion: SCHEMA,
  documents: [
    { documentId: 'D-OK', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-03-01', signatureMetadataPresent: true },
    { documentId: 'D-WRONG', memberId: 'M2', encounterId: 'E9', serviceDate: '2026-03-01', signatureMetadataPresent: true },
    { documentId: 'D-CONFLICT', memberId: 'M1', encounterId: 'E1', serviceDate: '2026-03-01', signatureMetadataPresent: true },
  ],
  submissions: [{ submissionId: 'S1', memberId: 'M1', encounterId: 'E1', codeRef: 'C-A' }],
  associations: [
    { associationId: 'L-OK', submissionId: 'S1', documentId: 'D-OK', illustrativeStatus: 'asserted_support' },
    { associationId: 'L-WRONG', submissionId: 'S1', documentId: 'D-WRONG', illustrativeStatus: 'asserted_support' },
    { associationId: 'L-CONFLICT', submissionId: 'S1', documentId: 'D-CONFLICT', illustrativeStatus: 'asserted_conflict' },
  ],
});

// Adversarial case 6: hostile text that must render inert and export safely
export const ADV_HOSTILE_TEXT = fixture('adv-hostile-text', 'Adversarial: script, HTML and formula text', 'Identifiers contain script tags and spreadsheet formulas; they must render inert and export safely.', {
  schemaVersion: SCHEMA,
  documents: [{ documentId: '<img src=x onerror=alert(1)>', memberId: '=HYPERLINK("http://evil.example")', encounterId: '@cmd', serviceDate: '2026-03-01', signatureMetadataPresent: true }],
  submissions: [
    { submissionId: '<script>alert(1)</script>', memberId: '=HYPERLINK("http://evil.example")', encounterId: '@cmd', codeRef: '+1-C' },
    { submissionId: '-2+3', memberId: '\tTAB', encounterId: '\rCR', codeRef: 'C-"quoted",comma' },
  ],
  associations: [{ associationId: '=SUM(A1:A9)', submissionId: '<script>alert(1)</script>', documentId: '<img src=x onerror=alert(1)>', illustrativeStatus: 'asserted_conflict' }],
});

export const FIXTURES = deepFreeze([GOLDEN, CLEAN, EMPTY]);
export const ADVERSARIAL_FIXTURES = deepFreeze([
  ADV_DUPLICATE_IDS,
  ADV_UNKNOWN_REFERENCE,
  ADV_INVALID_ENUM,
  ADV_TRIPLE_DUPLICATE,
  ADV_WINDOW_BOUNDARY,
  ADV_IMPOSSIBLE_DATE,
  ADV_MULTI_LINK,
  ADV_HOSTILE_TEXT,
]);
