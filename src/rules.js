// Versioned rule pack ce-structural-1. This is a FICTIONAL demo configuration.
// It is not CMS policy, not a RADV rule, and carries no legal, regulatory or clinical authority.

import { deepFreeze } from './freeze.js';

export const RULE_VERSION = 'ce-structural-1';

export const DEMO_WINDOW = deepFreeze({ start: '2026-01-01', end: '2026-12-31' });

export const SYNTHETIC_LABEL =
  'SYNTHETIC DEMO DATA. All members, encounters, documents and code references are fictitious. ' +
  'Structural checks only; no clinical, coding, payment or regulatory determination is made.';

export const CONSISTENT_LABEL = 'structurally consistent, human clinical review required';

// Alphabetical order; this is also the order used in summary.countsByRule.
export const RULE_IDS = deepFreeze([
  'ASSERTED_CONFLICT',
  'DUPLICATE_SUBMISSION',
  'ENCOUNTER_MISMATCH',
  'MEMBER_MISMATCH',
  'NO_ASSOCIATION',
  'OUTSIDE_DEMO_WINDOW',
  'SIGNATURE_METADATA_MISSING',
]);

export const RULE_PACK = deepFreeze({
  ruleVersion: RULE_VERSION,
  window: { start: DEMO_WINDOW.start, end: DEMO_WINDOW.end },
  provenance: {
    kind: 'fictional-demo-configuration',
    source: 'atlas/docs/specs/CODEEVIDENCE-VERTICAL-SLICE.md',
    statement:
      'Rule pack ce-structural-1 is a fictional, versioned demo configuration defined in the spec file ' +
      'CODEEVIDENCE-VERTICAL-SLICE.md. It is not CMS policy, not RADV guidance, and not clinical or legal advice. ' +
      'The window 2026-01-01..2026-12-31 is illustrative only.',
  },
  rules: {
    NO_ASSOCIATION: {
      ruleId: 'NO_ASSOCIATION',
      level: 'submission',
      title: 'No association',
      description: 'The submission has no explicit association to any document record.',
    },
    DUPLICATE_SUBMISSION: {
      ruleId: 'DUPLICATE_SUBMISSION',
      level: 'submission',
      title: 'Duplicate submission',
      description:
        'The submission shares the exact (memberId, encounterId, codeRef) tuple with a lexicographically earlier submission; the lowest submissionId is canonical.',
    },
    MEMBER_MISMATCH: {
      ruleId: 'MEMBER_MISMATCH',
      level: 'association',
      title: 'Member mismatch',
      description: 'The associated document memberId differs from the submission memberId.',
    },
    ENCOUNTER_MISMATCH: {
      ruleId: 'ENCOUNTER_MISMATCH',
      level: 'association',
      title: 'Encounter mismatch',
      description: 'The associated document encounterId differs from the submission encounterId.',
    },
    OUTSIDE_DEMO_WINDOW: {
      ruleId: 'OUTSIDE_DEMO_WINDOW',
      level: 'association',
      title: 'Outside demo window',
      description: 'The associated document serviceDate is outside the illustrative window (inclusive, calendar-day compare).',
    },
    SIGNATURE_METADATA_MISSING: {
      ruleId: 'SIGNATURE_METADATA_MISSING',
      level: 'association',
      title: 'Signature metadata missing',
      description: 'The associated document records signatureMetadataPresent = false.',
    },
    ASSERTED_CONFLICT: {
      ruleId: 'ASSERTED_CONFLICT',
      level: 'association',
      title: 'Asserted conflict',
      description: 'The association carries the supplied fixture status asserted_conflict. This is a supplied statement, not a product conclusion.',
    },
  },
});
