// Pure, testable UI helpers for the CodeEvidence workbench. No DOM access here.

import { escapeHtml, csvCell, isValidCalendarDate, RULE_IDS, DECISIONS } from '../src/index.js';

export { escapeHtml, csvCell, RULE_IDS, DECISIONS };

export const FILTER_DEFAULTS = Object.freeze({ ruleId: '', query: '', missingAssociationOnly: false });

// Filters a findings array. ruleId: exact match or ''. query: case-insensitive substring over
// submissionId, associationId, documentId and canonicalSubmissionId. missingAssociationOnly: NO_ASSOCIATION rows.
export function filterFindings(findings, { ruleId = '', query = '', missingAssociationOnly = false } = {}) {
  const q = String(query).trim().toLowerCase();
  return findings.filter((f) => {
    if (ruleId && f.ruleId !== ruleId) return false;
    if (missingAssociationOnly && f.ruleId !== 'NO_ASSOCIATION') return false;
    if (q) {
      const hay = `${f.submissionId}\n${f.associationId}\n${f.documentId}\n${f.canonicalSubmissionId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// Formats a validated YYYY-MM-DD string for display without any Date or time zone logic.
export function formatDate(value) {
  if (!isValidCalendarDate(value)) return 'invalid date';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = value.split('-');
  return `${d} ${months[Number(m) - 1]} ${y} (${value})`;
}

// Summary rows for the counts panel, read straight from a report summary.
export function summaryRows(summary) {
  return [
    ['Submissions', summary.submissions],
    ['Documents', summary.documents],
    ['Associations', summary.associations],
    ['Flagged submissions', summary.flaggedSubmissions],
    ['Structurally consistent submissions', summary.structurallyConsistentSubmissions],
    ['Findings', summary.findings],
  ];
}

// Human label for a decision code. Unknown codes fall back to the raw code, escaped by the caller.
export function decisionLabel(code) {
  const labels = {
    escalate_to_clinical_review: 'Escalate to clinical review',
    structural_finding_confirmed: 'Structural finding confirmed',
    structural_finding_disputed: 'Structural finding disputed',
    deferred: 'Deferred',
  };
  return labels[code] || String(code);
}

// Resolves the records a finding cites from the frozen input snapshot.
export function citedRecords(report, finding) {
  const submission = report.input.submissions.find((s) => s.submissionId === finding.submissionId) || null;
  const association = finding.associationId ? report.input.associations.find((a) => a.associationId === finding.associationId) || null : null;
  const document = finding.documentId ? report.input.documents.find((d) => d.documentId === finding.documentId) || null : null;
  const canonical = finding.canonicalSubmissionId ? report.input.submissions.find((s) => s.submissionId === finding.canonicalSubmissionId) || null : null;
  return { submission, association, document, canonical };
}

export function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}
