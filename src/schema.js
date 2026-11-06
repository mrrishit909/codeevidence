// Strict atomic validation for schemaVersion code-evidence-demo-1.
// parseInput(text) -> size check -> JSON.parse -> depth check -> validate -> {ok, data} | {ok:false, errors}.
// Any error means no data is returned at all.

import { isValidCalendarDate } from './dates.js';
import { isPlainObject } from './freeze.js';
import { RULE_VERSION } from './rules.js';

export const SCHEMA_VERSION = 'code-evidence-demo-1';

export const LIMITS = Object.freeze({
  maxInputBytes: 1024 * 1024,
  maxSubmissions: 1000,
  maxDocuments: 2000,
  maxAssociations: 5000,
  maxIdLength: 200,
  maxNoteLength: 2000,
  maxExportBytes: 10 * 1024 * 1024,
  maxDepth: 8,
  maxErrors: 200,
});

export const STATUS_ENUM = Object.freeze(['asserted_support', 'asserted_conflict', 'unreviewed']);

const ROOT_KEYS = Object.freeze(['schemaVersion', 'ruleVersion', 'submissions', 'documents', 'associations']);
const SUBMISSION_KEYS = Object.freeze(['submissionId', 'memberId', 'encounterId', 'codeRef']);
const DOCUMENT_KEYS = Object.freeze(['documentId', 'memberId', 'encounterId', 'serviceDate', 'signatureMetadataPresent']);
const ASSOCIATION_KEYS = Object.freeze(['associationId', 'submissionId', 'documentId', 'illustrativeStatus']);

// UTF-8 byte length without relying on platform globals.
export function utf8ByteLength(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // surrogate pair -> 4 bytes, skip the low surrogate
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

// Returns the nesting depth of a parsed JSON value (scalars = 0, {} or [] = 1), stopping early past limit.
export function measureDepth(value, limit) {
  let maxDepth = 0;
  const stack = [[value, 0]];
  while (stack.length > 0) {
    const [node, depth] = stack.pop();
    if (node === null || typeof node !== 'object') continue;
    const d = depth + 1;
    if (d > maxDepth) maxDepth = d;
    if (d > limit) return d;
    const children = Array.isArray(node) ? node : Object.values(node);
    for (const child of children) {
      if (child !== null && typeof child === 'object') stack.push([child, d]);
    }
  }
  return maxDepth;
}

function err(code, path, message) {
  return { code, path, message };
}

function checkString(errors, record, key, path, maxLength) {
  const v = record[key];
  if (typeof v !== 'string') {
    errors.push(err('WRONG_TYPE', `${path}.${key}`, `${key} must be a string`));
    return false;
  }
  if (v.length === 0) {
    errors.push(err('EMPTY_STRING', `${path}.${key}`, `${key} must not be empty`));
    return false;
  }
  if (v.length > maxLength) {
    errors.push(err('STRING_TOO_LONG', `${path}.${key}`, `${key} exceeds ${maxLength} characters`));
    return false;
  }
  return true;
}

function checkRecordShape(errors, record, path, allowedKeys) {
  if (!isPlainObject(record)) {
    errors.push(err('WRONG_TYPE', path, 'record must be an object'));
    return false;
  }
  let ok = true;
  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      errors.push(err('MISSING_REQUIRED', `${path}.${key}`, `${key} is required`));
      ok = false;
    }
  }
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      errors.push(err('UNKNOWN_KEY', `${path}.${key}`, `unknown key ${key}`));
      ok = false;
    }
  }
  return ok;
}

function checkArray(errors, root, key, maxRows) {
  if (!Object.prototype.hasOwnProperty.call(root, key)) {
    errors.push(err('MISSING_REQUIRED', key, `${key} is required`));
    return false;
  }
  if (!Array.isArray(root[key])) {
    errors.push(err('WRONG_TYPE', key, `${key} must be an array`));
    return false;
  }
  if (root[key].length > maxRows) {
    errors.push(err('TOO_MANY_ROWS', key, `${key} exceeds ${maxRows} rows`));
    return false;
  }
  return true;
}

// Validates a parsed dataset. Returns an array of {code, path, message}; empty means valid.
export function validateDataset(data) {
  const errors = [];
  if (!isPlainObject(data)) {
    errors.push(err('ROOT_NOT_OBJECT', '', 'root must be a JSON object'));
    return errors;
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    errors.push(err('UNKNOWN_SCHEMA_VERSION', 'schemaVersion', `schemaVersion must be ${SCHEMA_VERSION}`));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'ruleVersion') && data.ruleVersion !== RULE_VERSION) {
    errors.push(err('UNKNOWN_RULE_VERSION', 'ruleVersion', `ruleVersion, when present, must be ${RULE_VERSION}`));
  }
  for (const key of Object.keys(data)) {
    if (!ROOT_KEYS.includes(key)) errors.push(err('UNKNOWN_KEY', key, `unknown root key ${key}`));
  }
  const subsOk = checkArray(errors, data, 'submissions', LIMITS.maxSubmissions);
  const docsOk = checkArray(errors, data, 'documents', LIMITS.maxDocuments);
  const linksOk = checkArray(errors, data, 'associations', LIMITS.maxAssociations);
  if (errors.length > 0) return errors.slice(0, LIMITS.maxErrors);

  const submissionIds = new Set();
  const documentIds = new Set();
  const associationIds = new Set();

  if (subsOk) {
    data.submissions.forEach((rec, i) => {
      const path = `submissions[${i}]`;
      if (!checkRecordShape(errors, rec, path, SUBMISSION_KEYS)) return;
      const idOk = checkString(errors, rec, 'submissionId', path, LIMITS.maxIdLength);
      checkString(errors, rec, 'memberId', path, LIMITS.maxIdLength);
      checkString(errors, rec, 'encounterId', path, LIMITS.maxIdLength);
      checkString(errors, rec, 'codeRef', path, LIMITS.maxIdLength);
      if (idOk) {
        if (submissionIds.has(rec.submissionId)) {
          errors.push(err('DUPLICATE_ID', `${path}.submissionId`, `duplicate submissionId ${rec.submissionId}`));
        } else submissionIds.add(rec.submissionId);
      }
    });
  }
  if (docsOk) {
    data.documents.forEach((rec, i) => {
      const path = `documents[${i}]`;
      if (!checkRecordShape(errors, rec, path, DOCUMENT_KEYS)) return;
      const idOk = checkString(errors, rec, 'documentId', path, LIMITS.maxIdLength);
      checkString(errors, rec, 'memberId', path, LIMITS.maxIdLength);
      checkString(errors, rec, 'encounterId', path, LIMITS.maxIdLength);
      if (typeof rec.serviceDate !== 'string') {
        errors.push(err('WRONG_TYPE', `${path}.serviceDate`, 'serviceDate must be a string'));
      } else if (!isValidCalendarDate(rec.serviceDate)) {
        errors.push(err('INVALID_DATE', `${path}.serviceDate`, `serviceDate ${rec.serviceDate} is not a valid YYYY-MM-DD calendar date`));
      }
      if (typeof rec.signatureMetadataPresent !== 'boolean') {
        errors.push(err('WRONG_TYPE', `${path}.signatureMetadataPresent`, 'signatureMetadataPresent must be a boolean'));
      }
      if (idOk) {
        if (documentIds.has(rec.documentId)) {
          errors.push(err('DUPLICATE_ID', `${path}.documentId`, `duplicate documentId ${rec.documentId}`));
        } else documentIds.add(rec.documentId);
      }
    });
  }
  if (linksOk) {
    data.associations.forEach((rec, i) => {
      const path = `associations[${i}]`;
      if (!checkRecordShape(errors, rec, path, ASSOCIATION_KEYS)) return;
      const idOk = checkString(errors, rec, 'associationId', path, LIMITS.maxIdLength);
      const subOk = checkString(errors, rec, 'submissionId', path, LIMITS.maxIdLength);
      const docOk = checkString(errors, rec, 'documentId', path, LIMITS.maxIdLength);
      if (typeof rec.illustrativeStatus !== 'string' || !STATUS_ENUM.includes(rec.illustrativeStatus)) {
        errors.push(err('INVALID_ENUM', `${path}.illustrativeStatus`, `illustrativeStatus must be one of ${STATUS_ENUM.join('|')}`));
      }
      if (idOk) {
        if (associationIds.has(rec.associationId)) {
          errors.push(err('DUPLICATE_ID', `${path}.associationId`, `duplicate associationId ${rec.associationId}`));
        } else associationIds.add(rec.associationId);
      }
      if (subOk && !submissionIds.has(rec.submissionId)) {
        errors.push(err('UNRESOLVED_REFERENCE', `${path}.submissionId`, `submissionId ${rec.submissionId} does not exist`));
      }
      if (docOk && !documentIds.has(rec.documentId)) {
        errors.push(err('UNRESOLVED_REFERENCE', `${path}.documentId`, `documentId ${rec.documentId} does not exist`));
      }
    });
  }
  return errors.slice(0, LIMITS.maxErrors);
}

// Full pipeline over raw text. Never returns partial data.
export function parseInput(text) {
  if (typeof text !== 'string') {
    return { ok: false, errors: [err('INPUT_NOT_STRING', '', 'input must be a string')] };
  }
  const bytes = utf8ByteLength(text);
  if (bytes > LIMITS.maxInputBytes) {
    return { ok: false, errors: [err('INPUT_TOO_LARGE', '', `input is ${bytes} bytes; limit is ${LIMITS.maxInputBytes}`)] };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [err('INVALID_JSON', '', `input is not valid JSON: ${e.message}`)] };
  }
  const depth = measureDepth(data, LIMITS.maxDepth);
  if (depth > LIMITS.maxDepth) {
    return { ok: false, errors: [err('DEPTH_EXCEEDED', '', `nesting depth exceeds ${LIMITS.maxDepth}`)] };
  }
  const errors = validateDataset(data);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data };
}
