import { resultsAPI, escapeHtml, valueOf } from './api.js';
import { getPortalContext, signOut, studentId, admissionNumber, studentName, subjectName, extractRows, errorMessage } from './portal.js';

let context;
let standings = [];
let subjectCount = 0;
const byStudentId = new Map();

initialize();

async function initialize() {
  document.getElementById('logoutButton').addEventListener('click', signOut);
  document.getElementById('closeResultModal').addEventListener('click', closeModal);
  document.getElementById('studentResultModal').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeModal(); });
  document.getElementById('positionsRows').addEventListener('click', handleResultClick);
  document.getElementById('positionSearch').addEventListener('input', filterPositions);
  try {
    context = await getPortalContext();
    document.getElementById('className').textContent = context.className || 'Assigned class';
    const [response, subjectResponse] = await Promise.all([
      resultsAPI.standings(context.classId),
      resultsAPI.listSubjects(context.classId).catch(() => []),
    ]);
    standings = extractRows(response, ['standings', 'results', 'students', 'items']);
    subjectCount = extractRows(subjectResponse, ['subjects', 'items']).length;
    standings.forEach((record) => {
      const student = record.student || record;
      const id = valueOf(record, 'studentId', 'student_id', 'id') || studentId(student);
      if (id !== '') byStudentId.set(String(id), record);
    });
    renderStandings();
  } catch (error) {
    showMessage(errorMessage(error, 'Could not load class standings.'));
  }
}

function renderStandings() {
  document.getElementById('rankedCount').textContent = standings.length.toLocaleString();
  const studentAverages = standings.map(studentAverage).filter((average) => average !== null);
  const classAverage = studentAverages.length
    ? studentAverages.reduce((sum, average) => sum + average, 0) / studentAverages.length
    : null;
  document.getElementById('classAverage').textContent = classAverage === null ? '—' : `${classAverage.toFixed(1)}%`;
  document.getElementById('positionsRows').innerHTML = standings.map((record) => {
    const student = record.student || record;
    const id = valueOf(record, 'studentId', 'student_id', 'id') || studentId(student);
    const admission = admissionNumber(student) || '—';
    const name = studentName(student) || 'Unnamed student';
    const position = valueOf(record, 'position', 'rank', 'classPosition', 'class_position');
    const totalScore = valueOf(record, 'totalScore', 'total_score', 'total');
    const average = valueOf(record, 'average', 'averagePercentage', 'average_percentage', 'percentage');
    const rankLabel = position !== '' ? `${position}${ordinal(Number(position))}` : '—';
    const maxScore = valueOf(record, 'maxScore', 'max_score', 'maximumScore', 'maximum_score') || (subjectCount ? subjectCount * 100 : '');
    const calculatedAverage = studentAverage(record) ?? (average === '' ? null : Number(average));
    const totalLabel = totalScore === '' ? '—' : `${totalScore} / ${maxScore || '—'}`;
    const averageLabel = calculatedAverage === null ? '—' : `${calculatedAverage.toFixed(1)}%`;
    const complete = record.status?.complete ?? record.complete ?? true;
    const badge = complete ? '<span class="result-badge is-entered">Complete</span>' : '<span class="result-badge is-missing">Incomplete</span>';
    return `<tr data-search-text="${escapeHtml(`${name} ${admission}`.toLowerCase())}"><td data-label="Position"><strong class="position-number">${escapeHtml(rankLabel)}</strong></td><td data-label="Admission number"><span class="admission-chip">${escapeHtml(admission)}</span></td><td data-label="Student name"><strong>${escapeHtml(name)}</strong></td><td data-label="Total score">${escapeHtml(totalLabel)}</td><td data-label="Average">${escapeHtml(averageLabel)}</td><td data-label="Result status">${badge}</td><td data-label="Action"><button class="button button-secondary" type="button" data-view-result="${escapeHtml(id)}" ${id === '' ? 'disabled' : ''}>View result</button></td></tr>`;
  }).join('');
  document.getElementById('positionEmpty').hidden = standings.length > 0;
  filterPositions();
}

function filterPositions() {
  const query = document.getElementById('positionSearch').value.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll('#positionsRows tr').forEach((row) => {
    const matches = row.dataset.searchText.includes(query);
    row.hidden = !matches;
    if (matches) visible += 1;
  });
  document.getElementById('positionEmpty').hidden = standings.length > 0 && visible > 0;
  if (standings.length && !visible) document.getElementById('positionEmpty').textContent = 'No students match your search.';
}

async function handleResultClick(event) {
  const button = event.target.closest('[data-view-result]');
  if (!button) return;
  const id = button.dataset.viewResult;
  const record = byStudentId.get(String(id));
  if (!record) return;
  openModal();
  try {
    const response = await resultsAPI.studentResults(context.classId, id);
    renderResultModal(response, record);
  } catch (error) {
    document.getElementById('resultModalRows').innerHTML = `<tr><td colspan="6" class="missing-result">${escapeHtml(errorMessage(error, 'Could not load this student result.'))}</td></tr>`;
  }
}

function openModal() {
  document.getElementById('resultModalTitle').textContent = 'Loading result...';
  document.getElementById('resultModalAdmission').textContent = '';
  document.getElementById('resultModalSummary').replaceChildren();
  document.getElementById('resultModalRows').innerHTML = '<tr><td colspan="6" class="missing-result">Loading subject results...</td></tr>';
  document.getElementById('studentResultModal').showModal();
}

function renderResultModal(response, rankingRecord) {
  const body = unwrapObject(response);
  const student = body.student || rankingRecord.student || rankingRecord;
  const summary = body.summary || body.resultSummary || {};
  const resultRows = extractRows(body, ['results', 'subjects', 'scores', 'items']);
  const id = studentId(student) || valueOf(rankingRecord, 'studentId', 'student_id', 'id');
  const name = studentName(student) || 'Student result';
  const admission = admissionNumber(student) || '—';
  const position = firstPresent(
    valueOf(summary, 'position', 'rank', 'classPosition', 'class_position'),
    valueOf(rankingRecord, 'position', 'rank', 'classPosition', 'class_position'),
  );
  const totalScore = firstPresent(
    valueOf(summary, 'totalScore', 'total_score', 'total'),
    valueOf(rankingRecord, 'totalScore', 'total_score', 'total'),
  );
  const average = firstPresent(
    valueOf(summary, 'average', 'averagePercentage', 'average_percentage', 'percentage'),
    valueOf(rankingRecord, 'average', 'averagePercentage', 'average_percentage', 'percentage'),
  );
  const entered = valueOf(summary, 'enteredSubjects', 'entered_subjects', 'subjectCount', 'subject_count') || resultRows.length;
  const totalSubjects = valueOf(summary, 'totalSubjects', 'total_subjects') || resultRows.length;
  const resultAverage = resultRows.length
    ? resultRows.reduce((sum, item) => sum + Number(valueOf(item, 'finalTotal', 'final_total', 'total') || 0), 0) / resultRows.length
    : null;
  const averageValue = totalScore !== '' && (Number(totalSubjects) || subjectCount)
    ? Number(totalScore) / (Number(totalSubjects) || subjectCount)
    : resultAverage !== null ? resultAverage : average === '' ? null : Number(String(average).replace('%', ''));
  const suffix = formatPosition(position);
  const averageDisplay = averageValue === null ? '—' : `${averageValue.toFixed(1)}%`;
  document.getElementById('resultModalTitle').textContent = name;
  document.getElementById('resultModalAdmission').textContent = `${admission} · ${context.className || ''}`;
  document.getElementById('resultModalSummary').innerHTML = `<div><span>CLASS POSITION</span><strong>${escapeHtml(suffix)}</strong></div><div><span>TOTAL SCORE</span><strong>${totalScore === '' ? '—' : escapeHtml(totalScore)}</strong></div><div><span>AVERAGE</span><strong>${escapeHtml(averageDisplay)}</strong></div><div><span>RESULT STATUS</span><strong>${entered}/${totalSubjects} subjects scored</strong></div>`;
  document.getElementById('resultModalRows').innerHTML = resultRows.length ? resultRows.map(renderResultRow).join('') : '<tr><td colspan="6" class="missing-result">No subject results were returned.</td></tr>';
  document.getElementById('editStudentScores').onclick = () => { window.location.href = `/results/scores?student=${encodeURIComponent(id)}`; };
}

function renderResultRow(item) {
  const subject = item.subject && typeof item.subject === 'object' ? item.subject : item;
  const name = subjectName(subject) || valueOf(item, 'subjectName', 'subject_name') || `Subject ${valueOf(item, 'subjectId', 'subject_id') || ''}`;
  const ca = valueOf(item, 'totalCA', 'total_ca') || [Number(item.ca1) || 0, Number(item.ca2) || 0, Number(item.ca3) || 0].reduce((sum, mark) => sum + mark, 0);
  const exam = valueOf(item, 'examination', 'exam', 'examScore', 'exam_score');
  const final = valueOf(item, 'finalTotal', 'final_total', 'total');
  const percentage = valueOf(item, 'percentage');
  const grade = valueOf(item, 'grade');
  return `<tr><td data-label="Subject"><strong>${escapeHtml(name)}</strong></td><td data-label="Total CA">${escapeHtml(ca)} / 30</td><td data-label="Exam">${exam === '' ? '—' : `${escapeHtml(exam)} / 70`}</td><td data-label="Final total">${final === '' ? '—' : `${escapeHtml(final)} / 100`}</td><td data-label="Percentage">${percentage === '' ? '—' : `${escapeHtml(percentage)}%`}</td><td data-label="Grade"><span class="grade-badge">${escapeHtml(grade || '—')}</span></td></tr>`;
}

function unwrapObject(response) {
  let body = response?.data ?? response;
  for (let depth = 0; depth < 4 && body?.data && typeof body.data === 'object' && !Array.isArray(body.data); depth += 1) body = body.data;
  if (body?.result && typeof body.result === 'object' && !Array.isArray(body.result)) return body.result;
  return body || {};
}

function showMessage(message) {
  const el = document.createElement('p');
  el.className = 'form-message is-error';
  el.setAttribute('role', 'alert');
  el.textContent = message;
  document.querySelector('.portal-main').prepend(el);
}
function closeModal() { document.getElementById('studentResultModal').close(); }
function ordinal(number) { const lastTwo = number % 100; if (lastTwo >= 11 && lastTwo <= 13) return 'th'; return ({ 1: 'st', 2: 'nd', 3: 'rd' })[number % 10] || 'th'; }
function firstPresent(...values) { return values.find((value) => value !== '' && value !== null && value !== undefined) ?? ''; }
function studentAverage(record) {
  const rawTotal = valueOf(record, 'totalScore', 'total_score', 'total');
  const total = Number(rawTotal);
  if (rawTotal !== '' && subjectCount && Number.isFinite(total)) return total / subjectCount;
  const rawAverage = valueOf(record, 'average', 'averagePercentage', 'average_percentage', 'percentage');
  const average = Number(String(rawAverage).replace('%', ''));
  return rawAverage !== '' && Number.isFinite(average) ? average : null;
}
function formatPosition(position) {
  if (position === '') return 'Not ranked';
  if (typeof position === 'string' && /\d+(st|nd|rd|th)$/i.test(position.trim())) return position;
  const numericPosition = Number(position);
  return Number.isFinite(numericPosition) && numericPosition > 0 ? `${numericPosition}${ordinal(numericPosition)}` : String(position);
}
