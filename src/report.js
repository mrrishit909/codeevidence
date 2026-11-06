// Export, CSV and rendering-safety helpers. Pure, isomorphic.
// generatedAt and sourceHash are injected by the caller; the engine never reads the clock.

import { deepClone, deepFreeze, isPlainObject } from './freeze.js';
import { LIMITS, utf8ByteLength } from './schema.js';
import { SYNTHETIC_LABEL } from './rules.js';

export const EXPORT_VERSION = 'code-evidence-export-1';

export const DECISIONS = deepFreeze([
  'escalate_to_clinical_review',
  'structural_finding_confirmed',
  'structural_finding_disputed',
  'deferred',
]);

export class ExportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}

export function escapeHtml(value) {
  const s = String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// RFC 4180 field: always quoted, inner quotes doubled. Formula-leading cells get a single-quote prefix.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(values) {
  return values.map(csvCell).join(',');
}

// Every finding row also carries the ORIGINAL values of the records it cites (submission tuple,
// association status, document identity/date/signature) so the CSV is traceable on its own.
// Those values pass through csvCell like everything else, so formula-leading text is neutralized.
export const CSV_COLUMNS = deepFreeze([
  'findingId',
  'ruleId',
  'ruleVersion',
  'level',
  'submissionId',
  'memberId',
  'encounterId',
  'codeRef',
  'associationId',
  'illustrativeStatus',
  'documentId',
  'documentMemberId',
  'documentEncounterId',
  'serviceDate',
  'signatureMetadataPresent',
  'canonicalSubmissionId',
  'message',
  'decision',
  'note',
  'dataLabel',
]);

// Resolves the input records a finding cites from the frozen input snapshot. Missing -> {}.
function citedInput(report, finding) {
  const input = isPlainObject(report.input) ? report.input : {};
  const find = (rows, key, id) => (id && Array.isArray(rows) ? rows.find((r) => r[key] === id) : undefined) || {};
  return {
    submission: find(input.submissions, 'submissionId', finding.submissionId),
    association: find(input.associations, 'associationId', finding.associationId),
    document: find(input.documents, 'documentId', finding.documentId),
  };
}

// Validates the reviewer layer: plain objects keyed by existing finding IDs, bounded values.
export function validateReviewerLayer(report, notes, decisions) {
  const known = new Set(report.findings.map((f) => f.findingId));
  if (!isPlainObject(notes)) throw new ExportError('EXPORT_INVALID_ARGUMENT', 'notes must be an object keyed by findingId');
  if (!isPlainObject(decisions)) throw new ExportError('EXPORT_INVALID_ARGUMENT', 'decisions must be an object keyed by findingId');
  for (const [id, note] of Object.entries(notes)) {
    if (!known.has(id)) throw new ExportError('EXPORT_UNKNOWN_FINDING', `note references unknown findingId ${id}`);
    if (typeof note !== 'string') throw new ExportError('EXPORT_INVALID_ARGUMENT', `note for ${id} must be a string`);
    if (note.length > LIMITS.maxNoteLength) throw new ExportError('NOTE_TOO_LONG', `note for ${id} exceeds ${LIMITS.maxNoteLength} characters`);
  }
  for (const [id, decision] of Object.entries(decisions)) {
    if (!known.has(id)) throw new ExportError('EXPORT_UNKNOWN_FINDING', `decision references unknown findingId ${id}`);
    if (!DECISIONS.includes(decision)) throw new ExportError('EXPORT_INVALID_DECISION', `decision for ${id} must be one of ${DECISIONS.join('|')}`);
  }
}

export function buildCsv(report, { notes = {}, decisions = {} } = {}) {
  validateReviewerLayer(report, notes, decisions);
  const lines = [csvRow(CSV_COLUMNS)];
  for (const f of report.findings) {
    const cited = citedInput(report, f);
    lines.push(
      csvRow([
        f.findingId,
        f.ruleId,
        f.ruleVersion,
        f.level,
        f.submissionId,
        cited.submission.memberId,
        cited.submission.encounterId,
        cited.submission.codeRef,
        f.associationId,
        cited.association.illustrativeStatus,
        f.documentId,
        cited.document.memberId,
        cited.document.encounterId,
        cited.document.serviceDate,
        cited.document.signatureMetadataPresent,
        f.canonicalSubmissionId,
        f.message,
        decisions[f.findingId] || '',
        notes[f.findingId] || '',
        'synthetic demo data',
      ]),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

export function buildExport(report, { generatedAt, sourceHash, notes = {}, decisions = {} } = {}) {
  if (!isPlainObject(report) || !Array.isArray(report.findings) || !isPlainObject(report.summary)) {
    throw new ExportError('EXPORT_INVALID_ARGUMENT', 'report must be a validation report');
  }
  if (typeof generatedAt !== 'string' || generatedAt.length === 0) {
    throw new ExportError('EXPORT_INVALID_ARGUMENT', 'generatedAt must be supplied by the caller as a non-empty string');
  }
  if (typeof sourceHash !== 'string' || !/^[0-9a-f]{64}$/.test(sourceHash)) {
    throw new ExportError('EXPORT_INVALID_ARGUMENT', 'sourceHash must be a lowercase SHA-256 hex digest of the raw input text');
  }
  validateReviewerLayer(report, notes, decisions);
  return {
    exportVersion: EXPORT_VERSION,
    schemaVersion: report.schemaVersion,
    ruleVersion: report.ruleVersion,
    rulePack: deepClone(report.rulePack),
    synthetic: true,
    syntheticLabel: SYNTHETIC_LABEL,
    disclaimer: report.disclaimer,
    generatedAt,
    sourceHash,
    input: deepClone(report.input),
    summary: deepClone(report.summary),
    findings: deepClone(report.findings),
    notes: deepClone(notes),
    decisions: deepClone(decisions),
  };
}

// Serializes and enforces the 10 MiB export limit.
export function serializeExport(exportObject) {
  const text = JSON.stringify(exportObject, null, 2);
  assertExportSize(text);
  return text;
}

export function assertExportSize(text) {
  const bytes = utf8ByteLength(text);
  if (bytes > LIMITS.maxExportBytes) {
    throw new ExportError('EXPORT_TOO_LARGE', `export is ${bytes} bytes; limit is ${LIMITS.maxExportBytes}`);
  }
  return bytes;
}

export function roundtripExport(exportObject) {
  return JSON.parse(JSON.stringify(exportObject));
}
