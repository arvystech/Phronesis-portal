import { resultsAPI, escapeHtml, valueOf } from './api.js';
import { getPortalContext, signOut, studentId, admissionNumber, studentName, subjectId, subjectName, extractRows, errorMessage } from './portal.js';

const SCORE_LIMITS = { ca1: 10, ca2: 10, ca3: 10, examination: 70 };
const SCORE_SAVE_REDIRECT_SECONDS = 4;
let context;
let student;
let subjects = [];
let savedScores = [];
let redirectInterval;

initialize();

async function initialize() {
  document.getElementById('logoutButton').addEventListener('click', signOut);
  document.getElementById('scoreRows').addEventListener('input', handleScoreInput);
  document.getElementById('scoreForm').addEventListener('submit', saveScores);
  document.getElementById('scoreSavedModal').addEventListener('cancel', (event) => event.preventDefault());
  document.getElementById('returnToScoreList').addEventListener('click', returnToScoreEntry);
  try {
    context = await getPortalContext();
    const requestedId = new URLSearchParams(window.location.search).get('student');
    if (!requestedId) return window.location.replace('/results/dashboard');
    const [studentsResponse, subjectsResponse, scoresResponse] = await Promise.all([
      resultsAPI.listStudents(context.classId),
      resultsAPI.listSubjects(context.classId),
      resultsAPI.getScores(context.classId, requestedId),
    ]);
    const students = extractRows(studentsResponse, ['students', 'items']);
    student = students.find((record) => String(studentId(record)) === String(requestedId));
    if (!student) return window.location.replace('/results/dashboard');
    subjects = extractRows(subjectsResponse, ['subjects', 'items']);
    savedScores = extractRows(scoresResponse, ['scores', 'results', 'items']);
    if (!subjects.length) throw new Error('No subjects are assigned to this class.');
    renderPage();
  } catch (error) {
    showMessage(errorMessage(error, 'Could not load this student’s scores.'));
  }
}

function renderPage() {
  const name = studentName(student) || 'Unnamed student';
  const admission = admissionNumber(student) || '—';
  setText('classBadge', context.className || 'Assigned class');
  setText('className', context.className || 'Assigned class');
  setText('studentName', name);
  setText('admissionNumber', admission);
  setText('className', context.className || 'Assigned class');
  document.getElementById('backLink').href = '/results/dashboard';
  const periodNames = [context.sessionName, context.termName].filter(Boolean);
  if (periodNames.length) {
    const info = document.createElement('p');
    info.className = 'period-caption';
    info.textContent = periodNames.join(' · ');
    document.querySelector('.portal-heading').append(info);
  }
  document.getElementById('scoreRows').innerHTML = subjects.map((subject, index) => renderSubjectRow(subject, index)).join('');
  renderTotals();
}

function renderSubjectRow(subject, index) {
  const id = subjectId(subject);
  const previous = savedScores.find((score) => String(valueOf(score, 'subjectId', 'subject_id')) === String(id)) || {};
  const subjectLabel = subjectName(subject) || `Subject ${index + 1}`;
  return `<tr data-subject-id="${escapeHtml(id)}"><td data-label="S/N">${index + 1}</td><td data-label="Subject"><strong>${escapeHtml(subjectLabel)}</strong></td>${Object.entries(SCORE_LIMITS).map(([field, max]) => `<td data-label="${fieldLabel(field)}"><input class="score-input" name="${field}" type="number" min="0" max="${max}" step="1" value="${previous[field] ?? ''}" required aria-label="${escapeHtml(subjectLabel)} ${fieldLabel(field)}" inputmode="numeric"><small>/${max}</small></td>`).join('')}<td data-label="Total CA" class="calculated-cell" data-total-ca>0</td><td data-label="Final total" class="calculated-cell" data-final-total>0</td><td data-label="Percentage" class="calculated-cell" data-percentage>0%</td><td data-label="Grade" class="calculated-cell" data-grade>F</td></tr>`;
}

function handleScoreInput(event) {
  const input = event.target.closest('.score-input');
  if (!input) return;
  const max = Number(input.max);
  const value = Number(input.value);
  input.setCustomValidity(input.value !== '' && (value < 0 || value > max) ? `Enter a score from 0 to ${max}.` : '');
  renderRowTotals(input.closest('tr'));
}

function readRow(row) {
  return Object.fromEntries(Object.keys(SCORE_LIMITS).map((field) => [field, row.querySelector(`[name="${field}"]`).value]));
}

function renderRowTotals(row) {
  if (!row) return;
  const score = calculateScore(readRow(row));
  row.querySelector('[data-total-ca]').textContent = score.totalCA;
  row.querySelector('[data-final-total]').textContent = score.finalTotal;
  row.querySelector('[data-percentage]').textContent = `${score.percentage}%`;
  row.querySelector('[data-grade]').textContent = score.grade;
}

function renderTotals() { document.querySelectorAll('#scoreRows tr').forEach(renderRowTotals); }

async function saveScores(event) {
  event.preventDefault();
  const rows = [...document.querySelectorAll('#scoreRows tr')];
  const invalid = rows.flatMap((row) => [...row.querySelectorAll('.score-input')]).find((input) => !input.checkValidity() || !validScores(readRow(input.closest('tr'))));
  if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
  if (context.sessionId === '' || context.sessionId == null || context.termId === '' || context.termId == null) {
    return showMessage('The active session or term is missing from your teacher session. Please contact the administrator.');
  }

  const button = document.querySelector('#scoreForm button[type="submit"]');
  const status = document.getElementById('saveMessage');
  button.disabled = true;
  status.textContent = 'Saving scores...';
  status.classList.remove('is-success');
  try {
    const scoreEntries = rows.map((row) => {
      const values = readRow(row);
      const rawSubjectId = row.dataset.subjectId;
      const parsedSubjectId = rawSubjectId !== '' && Number.isFinite(Number(rawSubjectId)) ? Number(rawSubjectId) : rawSubjectId;
      return { subjectId: parsedSubjectId, ...Object.fromEntries(Object.entries(values).map(([field, value]) => [field, Number(value)])) };
    });
    await resultsAPI.saveScores(context.classId, studentId(student), { sessionId: context.sessionId, termId: context.termId, scores: scoreEntries });
    status.textContent = 'Scores saved successfully.';
    status.classList.add('is-success');
    showSaveSuccess();
  } catch (error) {
    status.textContent = errorMessage(error, 'Could not save scores. Please try again.');
    status.classList.remove('is-success');
  } finally {
    button.disabled = false;
  }
}

function calculateScore(scores) {
  const ca1 = Number(scores.ca1) || 0;
  const ca2 = Number(scores.ca2) || 0;
  const ca3 = Number(scores.ca3) || 0;
  const examination = Number(scores.examination) || 0;
  const totalCA = ca1 + ca2 + ca3;
  const finalTotal = totalCA + examination;
  const grade = finalTotal >= 70 ? 'A' : finalTotal >= 60 ? 'B' : finalTotal >= 50 ? 'C' : finalTotal >= 45 ? 'D' : finalTotal >= 40 ? 'E' : 'F';
  return { totalCA, finalTotal, percentage: finalTotal, grade };
}

function validScores(scores) {
  return Object.entries(SCORE_LIMITS).every(([field, max]) => scores[field] !== '' && Number.isFinite(Number(scores[field])) && Number(scores[field]) >= 0 && Number(scores[field]) <= max);
}
function fieldLabel(field) { return ({ ca1: 'CA 1', ca2: 'CA 2', ca3: 'CA 3', examination: 'Examination' })[field] || field; }
function setText(id, text) { document.getElementById(id).textContent = text; }
function showMessage(text) { document.getElementById('saveMessage').textContent = text; }

function showSaveSuccess() {
  let remaining = SCORE_SAVE_REDIRECT_SECONDS;
  const modal = document.getElementById('scoreSavedModal');
  const countdown = document.getElementById('scoreRedirectText');
  const updateCountdown = () => { countdown.textContent = `Returning to the score entry list in ${remaining} second${remaining === 1 ? '' : 's'}...`; };
  updateCountdown();
  modal.showModal();
  redirectInterval = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) return returnToScoreEntry();
    updateCountdown();
  }, 1000);
}

function returnToScoreEntry() {
  window.clearInterval(redirectInterval);
  window.location.replace('/results/dashboard');
}
