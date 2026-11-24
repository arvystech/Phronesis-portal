import { resultsAPI, escapeHtml } from './api.js';
import { getPortalContext, signOut, studentId, admissionNumber, studentName, extractRows, errorMessage } from './portal.js';

let roster = [];
let enteredIds = new Set();
let context;
const DEFAULT_PAGE_SIZE = 20;
let pageSize = DEFAULT_PAGE_SIZE;
let currentPage = 1;

initialize();

async function initialize() {
  document.getElementById('logoutButton').addEventListener('click', signOut);
  document.getElementById('studentSearch').addEventListener('input', () => { currentPage = 1; filterStudents(); });
  document.getElementById('scoreStatusFilter').addEventListener('change', () => { currentPage = 1; filterStudents(); });
  document.getElementById('studentPageSize').value = String(DEFAULT_PAGE_SIZE);
  document.getElementById('studentPageSize').addEventListener('change', (event) => {
    pageSize = Math.max(1, Number(event.target.value) || DEFAULT_PAGE_SIZE);
    currentPage = 1;
    filterStudents();
  });
  document.getElementById('previousStudentsPage').addEventListener('click', () => { if (currentPage > 1) { currentPage -= 1; filterStudents(); } });
  document.getElementById('nextStudentsPage').addEventListener('click', () => { currentPage += 1; filterStudents(); });
  try {
    context = await getPortalContext();
    setText('className', context.className || 'Assigned class');
    const [studentsResponse, standingsResponse] = await Promise.all([
      resultsAPI.listStudents(context.classId),
      resultsAPI.standings(context.classId).catch((error) => { showMessage(errorMessage(error, 'Could not determine which students have saved scores.')); return []; }),
    ]);
    roster = extractRows(studentsResponse, ['students', 'items']);
    const standings = extractRows(standingsResponse, ['standings', 'results', 'students', 'items']);
    enteredIds = new Set(standings.map((record) => String(record.studentId ?? record.student_id ?? record.student?.studentId ?? record.student?.student_id ?? record.student?.id ?? record.id)));
    renderStudents();
  } catch (error) {
    showMessage(errorMessage(error, 'Could not load your class roster.'));
  }
}

function renderStudents() {
  document.getElementById('studentCount').textContent = roster.length.toLocaleString();
  document.getElementById('studentRows').innerHTML = roster.map((student, index) => {
    const id = studentId(student);
    const admission = admissionNumber(student) || '—';
    const name = studentName(student) || 'Unnamed student';
    const hasResult = enteredIds.has(String(id));
    const badge = hasResult ? '<span class="result-badge is-entered">Results entered</span>' : '<span class="result-badge is-missing">Not entered</span>';
    const action = hasResult ? 'Edit scores' : 'Enter scores';
    const link = id !== '' ? `/results/scores?student=${encodeURIComponent(id)}` : '#';
    return `<tr data-search-text="${escapeHtml(`${name} ${admission}`.toLowerCase())}" data-score-status="${hasResult ? 'entered' : 'not-entered'}"><td data-label="S/N">${index + 1}</td><td data-label="Admission number"><span class="admission-chip">${escapeHtml(admission)}</span></td><td data-label="Student name"><strong>${escapeHtml(name)}</strong></td><td data-label="Result status">${badge}</td><td data-label="Action"><a class="button button-primary" href="${link}" ${id === '' ? 'aria-disabled="true" tabindex="-1"' : ''}>${action} <span aria-hidden="true">→</span></a></td></tr>`;
  }).join('');
  document.getElementById('studentEmpty').hidden = roster.length > 0;
  filterStudents();
}

function filterStudents() {
  const query = document.getElementById('studentSearch').value.trim().toLowerCase();
  const status = document.getElementById('scoreStatusFilter').value;
  const matchedRows = [];
  document.querySelectorAll('#studentRows tr').forEach((row) => {
    const matches = row.dataset.searchText.includes(query) && (status === 'all' || row.dataset.scoreStatus === status);
    row.hidden = true;
    if (matches) matchedRows.push(row);
  });
  const totalPages = Math.max(1, Math.ceil(matchedRows.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  matchedRows.slice(start, start + pageSize).forEach((row) => { row.hidden = false; });
  const visibleCount = Math.min(pageSize, Math.max(0, matchedRows.length - start));
  document.getElementById('studentEmpty').hidden = matchedRows.length > 0;
  document.getElementById('studentEmpty').textContent = 'No students match your search and filter.';
  document.getElementById('studentsPageInfo').textContent = matchedRows.length
    ? `Showing ${start + 1}-${start + visibleCount} of ${matchedRows.length}`
    : 'No students';
  document.getElementById('previousStudentsPage').disabled = currentPage <= 1;
  document.getElementById('nextStudentsPage').disabled = currentPage >= totalPages;
  document.getElementById('studentsPagination').hidden = matchedRows.length === 0;
}

function showMessage(message) {
  const el = document.getElementById('portalMessage') || createMessage();
  el.textContent = message;
  el.hidden = false;
}

function createMessage() {
  const el = document.createElement('p');
  el.id = 'portalMessage';
  el.className = 'form-message is-error';
  el.setAttribute('role', 'alert');
  document.querySelector('.portal-main').prepend(el);
  return el;
}

function setText(id, value) { document.getElementById(id).textContent = value; }
