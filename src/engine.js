// Deterministic structural rule engine for rule pack ce-structural-1.
// Input must already have passed validateDataset. Output is a deep-frozen report.

import { isWithinWindow } from './dates.js';
import { checkedAdd, checkedSubtract } from './integers.js';
import { deepClone, deepFreeze } from './freeze.js';
import { parseInput, SCHEMA_VERSION, validateDataset } from './schema.js';
import { CONSISTENT_LABEL, DEMO_WINDOW, RULE_IDS, RULE_PACK, RULE_VERSION, SYNTHETIC_LABEL } from './rules.js';

// Code-unit comparison: deterministic across locales. Used for sorting and canonical choice.
export function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function findingId(ruleId, submissionId, associationId) {
  return `${ruleId}|${encodeURIComponent(submissionId)}|${encodeURIComponent(associationId)}`;
}

function makeFinding(ruleId, submissionId, associationId, documentId, canonicalSubmissionId, message, details) {
  return {
    findingId: findingId(ruleId, submissionId, associationId),
    ruleId,
    ruleVersion: RULE_VERSION,
    level: RULE_PACK.rules[ruleId].level,
    submissionId,
    associationId,
    documentId,
    canonicalSubmissionId,
    message,
    details,
  };
}

export function compareFindings(a, b) {
  return (
    compareStrings(a.submissionId, b.submissionId) ||
    compareStrings(a.associationId, b.associationId) ||
    compareStrings(a.ruleId, b.ruleId)
  );
}

// Runs the rule pack over a validated dataset object. Throws if the dataset is invalid.
export function runValidation(data) {
  const errors = validateDataset(data);
  if (errors.length > 0) {
    const e = new Error('runValidation requires a validated dataset');
    e.code = 'INVALID_DATASET';
    e.errors = errors;
    throw e;
  }

  const documents = new Map();
  for (const doc of data.documents) documents.set(doc.documentId, doc);
  const linksBySubmission = new Map();
  for (const sub of data.submissions) linksBySubmission.set(sub.submissionId, []);
  for (const link of data.associations) linksBySubmission.get(link.submissionId).push(link);

  const findings = [];

  // Submission-level: NO_ASSOCIATION
  for (const sub of data.submissions) {
    if (linksBySubmission.get(sub.submissionId).length === 0) {
      findings.push(
        makeFinding('NO_ASSOCIATION', sub.submissionId, '', '', '', 'Submission has no explicit association to any document.', {
          memberId: sub.memberId,
          encounterId: sub.encounterId,
          codeRef: sub.codeRef,
        }),
      );
    }
  }

  // Submission-level: DUPLICATE_SUBMISSION on exact (memberId, encounterId, codeRef) tuple
  const groups = new Map();
  for (const sub of data.submissions) {
    const key = JSON.stringify([sub.memberId, sub.encounterId, sub.codeRef]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sub.submissionId);
  }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const sorted = [...ids].sort(compareStrings);
    const canonical = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
      findings.push(
        makeFinding(
          'DUPLICATE_SUBMISSION',
          sorted[i],
          '',
          '',
          canonical,
          `Submission repeats the exact (memberId, encounterId, codeRef) tuple of canonical submission ${canonical}.`,
          { canonicalSubmissionId: canonical, groupSize: ids.length },
        ),
      );
    }
  }

  // Association-level rules, each evaluated independently per association
  const subsById = new Map();
  for (const sub of data.submissions) subsById.set(sub.submissionId, sub);
  for (const link of data.associations) {
    const sub = subsById.get(link.submissionId);
    const doc = documents.get(link.documentId);
    const s = link.submissionId;
    const a = link.associationId;
    const d = link.documentId;
    if (doc.memberId !== sub.memberId) {
      findings.push(
        makeFinding('MEMBER_MISMATCH', s, a, d, '', 'Associated document memberId differs from submission memberId.', {
          submissionMemberId: sub.memberId,
          documentMemberId: doc.memberId,
        }),
      );
    }
    if (doc.encounterId !== sub.encounterId) {
      findings.push(
        makeFinding('ENCOUNTER_MISMATCH', s, a, d, '', 'Associated document encounterId differs from submission encounterId.', {
          submissionEncounterId: sub.encounterId,
          documentEncounterId: doc.encounterId,
        }),
      );
    }
    if (!isWithinWindow(doc.serviceDate, DEMO_WINDOW.start, DEMO_WINDOW.end)) {
      findings.push(
        makeFinding('OUTSIDE_DEMO_WINDOW', s, a, d, '', `Document serviceDate ${doc.serviceDate} is outside the illustrative window ${DEMO_WINDOW.start}..${DEMO_WINDOW.end}.`, {
          serviceDate: doc.serviceDate,
          windowStart: DEMO_WINDOW.start,
          windowEnd: DEMO_WINDOW.end,
        }),
      );
    }
    if (doc.signatureMetadataPresent === false) {
      findings.push(
        makeFinding('SIGNATURE_METADATA_MISSING', s, a, d, '', 'Document records signatureMetadataPresent = false.', {
          signatureMetadataPresent: false,
        }),
      );
    }
    if (link.illustrativeStatus === 'asserted_conflict') {
      findings.push(
        makeFinding('ASSERTED_CONFLICT', s, a, d, '', 'Association carries the supplied status asserted_conflict (a fixture statement, not a product conclusion).', {
          illustrativeStatus: link.illustrativeStatus,
        }),
      );
    }
  }

  findings.sort(compareFindings);

  // Summary with checked integer arithmetic
  const countsByRule = {};
  for (const ruleId of RULE_IDS) countsByRule[ruleId] = 0;
  let findingCount = 0;
  const flagged = new Set();
  for (const f of findings) {
    countsByRule[f.ruleId] = checkedAdd(countsByRule[f.ruleId], 1);
    findingCount = checkedAdd(findingCount, 1);
    flagged.add(f.submissionId);
  }
  let submissions = 0;
  for (let i = 0; i < data.submissions.length; i += 1) submissions = checkedAdd(submissions, 1);
  let documentCount = 0;
  for (let i = 0; i < data.documents.length; i += 1) documentCount = checkedAdd(documentCount, 1);
  let associations = 0;
  for (let i = 0; i < data.associations.length; i += 1) associations = checkedAdd(associations, 1);
  const flaggedSubmissions = flagged.size;
  const structurallyConsistentSubmissions = checkedSubtract(submissions, flaggedSubmissions);

  const report = {
    schemaVersion: SCHEMA_VERSION,
    ruleVersion: RULE_VERSION,
    rulePack: deepClone(RULE_PACK),
    synthetic: true,
    syntheticLabel: SYNTHETIC_LABEL,
    disclaimer:
      'Structural review only. Zero findings means ' + CONSISTENT_LABEL + '. No finding is a diagnosis rejection; no financial totals are computed.',
    input: deepClone(data),
    summary: {
      submissions,
      documents: documentCount,
      associations,
      flaggedSubmissions,
      structurallyConsistentSubmissions,
      structurallyConsistentLabel: CONSISTENT_LABEL,
      findings: findingCount,
      countsByRule,
    },
    findings,
  };
  return deepFreeze(report);
}

// Convenience: raw text -> {ok:true, report} | {ok:false, errors}. Never partial.
export function validateText(text) {
  const parsed = parseInput(text);
  if (!parsed.ok) return parsed;
  try {
    return { ok: true, report: runValidation(parsed.data) };
  } catch (e) {
    return { ok: false, errors: [{ code: e.code || 'ENGINE_ERROR', path: '', message: e.message }] };
  }
}
