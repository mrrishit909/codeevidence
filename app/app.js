// DOM glue for the CodeEvidence workbench. All data reaches the DOM via textContent.
import { parseInput, runValidation, buildExport, buildCsv, serializeExport, LIMITS, RULE_IDS, DECISIONS, RULE_PACK } from '../src/index.js';
import { FIXTURES, fixtureText } from '../fixtures/index.js';
import { filterFindings, formatDate, summaryRows, decisionLabel, citedRecords, bytesToHex } from './ui.js';

const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (cls) node.className = cls;
  return node;
};
const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
};

const state = {
  sourceText: '',
  sourceName: '',
  data: null,
  report: null,
  notes: {},
  decisions: {},
  selectedId: '',
  filters: { ruleId: '', query: '', missingAssociationOnly: false },
};

function setStatus(id, text, kind) {
  const node = $(id);
  node.textContent = text || '';
  if (kind) node.dataset.kind = kind;
  else delete node.dataset.kind;
}

function renderErrors(errors) {
  const list = $('error-list');
  clear(list);
  for (const e of errors) list.appendChild(el('li', `${e.code}${e.path ? ' at ' + e.path : ''}: ${e.message}`));
}

function renderTable(title, rows, columns) {
  const wrap = el('div', null, 'table-wrap');
  wrap.appendChild(el('h3', `${title} (${rows.length})`));
  if (rows.length === 0) {
    wrap.appendChild(el('p', 'No records.', 'empty'));
    return wrap;
  }
  const table = el('table');
  const thead = el('thead');
  const hr = el('tr');
  for (const c of columns) hr.appendChild(el('th', c));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    for (const c of columns) tr.appendChild(el('td', c === 'serviceDate' ? formatDate(row[c]) : String(row[c]), 'mono'));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function renderSource() {
  const host = $('source-tables');
  clear(host);
  if (!state.data) {
    host.appendChild(el('p', 'Load a fixture to inspect records.', 'empty'));
    return;
  }
  host.appendChild(renderTable('Submissions', state.data.submissions, ['submissionId', 'memberId', 'encounterId', 'codeRef']));
  host.appendChild(renderTable('Documents', state.data.documents, ['documentId', 'memberId', 'encounterId', 'serviceDate', 'signatureMetadataPresent']));
  host.appendChild(renderTable('Associations', state.data.associations, ['associationId', 'submissionId', 'documentId', 'illustrativeStatus']));
}

function renderSummary() {
  const host = $('summary');
  const byRule = $('by-rule');
  clear(host);
  clear(byRule);
  if (!state.report) {
    host.appendChild(el('p', 'Run validation to see counts.', 'empty'));
    $('disclaimer').textContent = '';
    return;
  }
  const s = state.report.summary;
  for (const [label, value] of summaryRows(s)) {
    const stat = el('div', null, 'stat' + (label === 'Flagged submissions' || label === 'Findings' ? ' flag' : ''));
    stat.appendChild(el('span', value, 'n'));
    stat.appendChild(el('span', label === 'Structurally consistent submissions' ? `${label} (human clinical review required)` : label, 'l'));
    host.appendChild(stat);
  }
  for (const ruleId of RULE_IDS) byRule.appendChild(el('span', `${ruleId} ${s.countsByRule[ruleId]}`));
  $('disclaimer').textContent = state.report.disclaimer;
}

function renderFindings() {
  const list = $('findings-list');
  clear(list);
  if (!state.report) {
    setStatus('findings-status', 'No report yet.');
    return;
  }
  const rows = filterFindings(state.report.findings, state.filters);
  if (state.report.findings.length === 0) {
    const s = state.report.summary;
    const noRecords = s.submissions === 0 && s.documents === 0 && s.associations === 0;
    setStatus('findings-status', noRecords
      ? 'No records loaded: the source has zero submissions, documents and associations, so no rule could run. Load a fixture with records. (Human clinical review required for any real decision.)'
      : 'Zero findings: structurally consistent, human clinical review required.');
    return;
  }
  setStatus('findings-status', `${rows.length} of ${state.report.findings.length} findings shown.`);
  if (rows.length === 0) {
    list.appendChild(el('li', 'No findings match the current filters.', 'empty'));
    return;
  }
  for (const f of rows) {
    const li = el('li');
    const btn = el('button', null, 'finding');
    btn.type = 'button';
    btn.dataset.findingId = f.findingId;
    btn.setAttribute('aria-pressed', f.findingId === state.selectedId ? 'true' : 'false');
    btn.appendChild(el('span', f.ruleId, 'rule'));
    const ids = el('span', null, 'ids');
    ids.appendChild(el('span', f.submissionId));
    if (f.associationId) {
      ids.appendChild(el('span', ' ── ', 'thread'));
      ids.appendChild(el('span', f.associationId));
      ids.appendChild(el('span', ' ── ', 'thread'));
      ids.appendChild(el('span', f.documentId));
    }
    if (f.canonicalSubmissionId) ids.appendChild(el('span', ` (canonical ${f.canonicalSubmissionId})`));
    btn.appendChild(ids);
    const marks = [];
    if (state.decisions[f.findingId]) marks.push(`decision: ${decisionLabel(state.decisions[f.findingId])}`);
    if (state.notes[f.findingId]) marks.push('note recorded');
    if (marks.length) btn.appendChild(el('span', marks.join(' / '), 'mark'));
    btn.addEventListener('click', () => openDetail(f.findingId));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function recordCard(title, record, keys) {
  const card = el('div', null, 'index-card');
  card.appendChild(el('h4', title));
  if (!record) {
    card.appendChild(el('p', 'none', 'empty'));
    return card;
  }
  const kv = el('div', null, 'kv');
  for (const k of keys) {
    kv.appendChild(el('span', k));
    kv.appendChild(el('span', k === 'serviceDate' ? formatDate(record[k]) : String(record[k])));
  }
  card.appendChild(kv);
  return card;
}

function openDetail(findingId) {
  if (!state.report) return;
  const f = state.report.findings.find((x) => x.findingId === findingId);
  if (!f) return;
  state.selectedId = findingId;
  const body = $('detail-body');
  clear(body);
  const dl = el('dl');
  const pairs = [
    ['Rule', f.ruleId],
    ['Rule version', f.ruleVersion],
    ['Provenance', `${RULE_PACK.provenance.kind}; source ${RULE_PACK.provenance.source}`],
    ['Level', f.level],
    ['Finding ID', f.findingId],
    ['Submission', f.submissionId],
    ['Association', f.associationId || '(submission-level)'],
    ['Document', f.documentId || '(none)'],
    ['Message', f.message],
    ['Details', JSON.stringify(f.details)],
  ];
  if (f.canonicalSubmissionId) pairs.push(['Canonical submission', f.canonicalSubmissionId]);
  for (const [k, v] of pairs) {
    dl.appendChild(el('dt', k));
    dl.appendChild(el('dd', v));
  }
  body.appendChild(dl);
  const cards = $('detail-cards');
  clear(cards);
  const cited = citedRecords(state.report, f);
  cards.appendChild(recordCard('Submission', cited.submission, ['submissionId', 'memberId', 'encounterId', 'codeRef']));
  if (cited.association) cards.appendChild(recordCard('Association', cited.association, ['associationId', 'submissionId', 'documentId', 'illustrativeStatus']));
  if (cited.document) cards.appendChild(recordCard('Document', cited.document, ['documentId', 'memberId', 'encounterId', 'serviceDate', 'signatureMetadataPresent']));
  if (cited.canonical) cards.appendChild(recordCard('Canonical submission', cited.canonical, ['submissionId', 'memberId', 'encounterId', 'codeRef']));
  $('decision-select').value = state.decisions[findingId] || '';
  $('note-input').value = state.notes[findingId] || '';
  updateCounter();
  renderReviewView();
  setStatus('review-status', '');
  $('detail').classList.remove('hidden');
  renderFindings();
  $('detail').focus();
}

function renderReviewView() {
  const view = $('review-view');
  const note = state.notes[state.selectedId];
  const decision = state.decisions[state.selectedId];
  if (!note && !decision) {
    view.classList.add('hidden');
    view.textContent = '';
    return;
  }
  view.classList.remove('hidden');
  view.textContent = `Decision: ${decision ? decisionLabel(decision) : 'none'}\nNote: ${note || '(none)'}`;
}

function closeDetail() {
  $('detail').classList.add('hidden');
  const id = state.selectedId;
  state.selectedId = '';
  renderFindings();
  // WCAG 2.4.3: return focus to the finding button that opened the detail. The list is re-rendered,
  // so the opener is re-resolved by finding id; fall back to the findings list if it was filtered out.
  const opener = Array.from(document.querySelectorAll('.finding')).find((b) => b.dataset.findingId === id);
  (opener || $('findings-list')).focus();
}

function updateCounter() {
  $('note-counter').textContent = `${$('note-input').value.length} / ${LIMITS.maxNoteLength}`;
}

function saveReview() {
  if (!state.selectedId) return;
  const note = $('note-input').value;
  const decision = $('decision-select').value;
  if (note.length > LIMITS.maxNoteLength) {
    setStatus('review-status', `Note exceeds ${LIMITS.maxNoteLength} characters.`, 'error');
    return;
  }
  if (decision && !DECISIONS.includes(decision)) {
    setStatus('review-status', 'Unknown decision.', 'error');
    return;
  }
  if (note) state.notes[state.selectedId] = note;
  else delete state.notes[state.selectedId];
  if (decision) state.decisions[state.selectedId] = decision;
  else delete state.decisions[state.selectedId];
  setStatus('review-status', 'Saved to the reviewer layer. The finding itself is unchanged.');
  renderReviewView();
  renderFindings();
}

function resetReport() {
  state.report = null;
  state.notes = {};
  state.decisions = {};
  state.selectedId = '';
  $('detail').classList.add('hidden');
  renderSummary();
  renderFindings();
  $('export-json').disabled = true;
  $('export-csv').disabled = true;
  setStatus('export-status', '');
}

function loadText(text, name) {
  setStatus('source-status', 'Checking input...');
  renderErrors([]);
  const result = parseInput(text);
  if (!result.ok) {
    setStatus('source-status', `${name}: rejected with ${result.errors.length} error(s). Previously loaded source is unchanged.`, 'error');
    renderErrors(result.errors);
    return;
  }
  state.sourceText = text;
  state.sourceName = name;
  state.data = result.data;
  resetReport();
  renderSource();
  $('run-validation').disabled = false;
  setStatus('source-status', `${name}: ${result.data.submissions.length} submissions, ${result.data.documents.length} documents, ${result.data.associations.length} associations loaded (synthetic).`);
  setStatus('run-status', '');
}

function runNow() {
  if (!state.data) return;
  setStatus('run-status', 'Running rule pack...');
  try {
    const report = runValidation(state.data);
    state.report = report;
    state.notes = {};
    state.decisions = {};
    state.selectedId = '';
    renderSummary();
    renderFindings();
    $('export-json').disabled = false;
    $('export-csv').disabled = false;
    setStatus('run-status', `Done. ${report.summary.findings} finding(s) under ${report.ruleVersion}.`);
  } catch (e) {
    setStatus('run-status', `Validation failed: ${e.code || 'ENGINE_ERROR'} ${e.message}`, 'error');
    resetReport();
  }
}

async function sha256Hex(text) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) throw new Error('crypto.subtle unavailable; serve over http://127.0.0.1 or file with secure context');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(digest);
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportJson() {
  if (!state.report) return;
  setStatus('export-status', 'Building export...');
  try {
    const sourceHash = await sha256Hex(state.sourceText);
    const generatedAt = new Date().toISOString();
    const exp = buildExport(state.report, { generatedAt, sourceHash, notes: state.notes, decisions: state.decisions });
    const text = serializeExport(exp);
    download('codeevidence-synthetic-export.json', text, 'application/json');
    setStatus('export-status', `JSON export downloaded (${exp.findings.length} findings, sourceHash ${sourceHash.slice(0, 12)}...).`);
  } catch (e) {
    setStatus('export-status', `Export failed: ${e.code || 'EXPORT_ERROR'} ${e.message}`, 'error');
  }
}

function exportCsv() {
  if (!state.report) return;
  try {
    const csv = buildCsv(state.report, { notes: state.notes, decisions: state.decisions });
    download('codeevidence-synthetic-findings.csv', csv, 'text/csv');
    setStatus('export-status', 'CSV export downloaded (formula-leading cells neutralized).');
  } catch (e) {
    setStatus('export-status', `Export failed: ${e.code || 'EXPORT_ERROR'} ${e.message}`, 'error');
  }
}

function init() {
  const select = $('fixture-select');
  for (const fx of FIXTURES) {
    const opt = el('option', fx.title);
    opt.value = fx.id;
    select.appendChild(opt);
  }
  const ruleSelect = $('filter-rule');
  for (const ruleId of RULE_IDS) {
    const opt = el('option', ruleId);
    opt.value = ruleId;
    ruleSelect.appendChild(opt);
  }
  const decisionSelect = $('decision-select');
  decisionSelect.appendChild(Object.assign(el('option', 'No decision yet'), { value: '' }));
  for (const d of DECISIONS) {
    const opt = el('option', decisionLabel(d));
    opt.value = d;
    decisionSelect.appendChild(opt);
  }
  $('load-fixture').addEventListener('click', () => {
    const fx = FIXTURES.find((f) => f.id === select.value);
    if (fx) loadText(fixtureText(fx), fx.title);
  });
  // No arbitrary file import in the public demo UI (seeded synthetic fixtures only, per the Atlas gate).
  // The strict parser (parseInput) stays in src/ and is exercised by tests/schema.test.js and tests/adversarial.test.js.
  $('run-validation').addEventListener('click', runNow);
  $('filter-rule').addEventListener('change', (e) => {
    state.filters = { ...state.filters, ruleId: e.target.value };
    renderFindings();
  });
  $('filter-query').addEventListener('input', (e) => {
    state.filters = { ...state.filters, query: e.target.value };
    renderFindings();
  });
  $('filter-missing').addEventListener('change', (e) => {
    state.filters = { ...state.filters, missingAssociationOnly: e.target.checked };
    renderFindings();
  });
  $('note-input').addEventListener('input', updateCounter);
  $('save-review').addEventListener('click', saveReview);
  $('close-detail').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('detail').classList.contains('hidden')) closeDetail();
  });
  $('export-json').addEventListener('click', exportJson);
  $('export-csv').addEventListener('click', exportCsv);
  renderSource();
  renderSummary();
  renderFindings();
}

init();
