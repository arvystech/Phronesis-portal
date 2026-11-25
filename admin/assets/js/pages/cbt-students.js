import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { classesAPI, subjectsAPI } from '../api.js';
import { cbtAdminAPI } from '../cbt-api.js';

const PAGE_SIZE = 50;
let page = 1;
let totalPages = 1;
let searchTimer;
let subjectSearchTimer;
let exams = [];
let subjectAttemptRows = [];
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const records = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === 'object') return records(payload.data, keys);
  return [];
};
const idOf = (item) => item?.subject_id ?? item?.subjectId ?? item?.id;
const subjectIdOfExam = (exam) => exam?.subject_id ?? exam?.subjectId ?? exam?.subject?.subject_id ?? exam?.subject?.id;
const fullName = (student) => [student?.first_name ?? student?.firstName, student?.middle_name ?? student?.middleName, student?.last_name ?? student?.lastName].filter(Boolean).join(' ');

document.addEventListener('DOMContentLoaded', () => {
  setupLayout('cbt-students', 'CBT Students');
  requireAuth(init);
});

async function init() {
  $('searchStudents').addEventListener('click', () => { page = 1; loadStudents(); });
  $('studentSearch').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { page = 1; loadStudents(); }, 350);
  });
  $('classFilter').addEventListener('change', () => { page = 1; loadStudents(); });
  $('statusFilter').addEventListener('change', () => { page = 1; loadStudents(); });
  $('previousPage').addEventListener('click', () => { if (page > 1) { page -= 1; loadStudents(); } });
  $('nextPage').addEventListener('click', () => { if (page < totalPages) { page += 1; loadStudents(); } });
  document.querySelectorAll('[data-cbt-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.cbtView)));
  $('subjectTeacherSubject').addEventListener('change', loadSubjectAttempts);
  $('subjectTeacherClass').addEventListener('change', renderSubjectAttempts);
  $('subjectTeacherSearch').addEventListener('input', () => {
    clearTimeout(subjectSearchTimer);
    subjectSearchTimer = setTimeout(renderSubjectAttempts, 200);
  });
  $('searchSubjectStudents').addEventListener('click', renderSubjectAttempts);

  const [classResult, subjectResult, examResult] = await Promise.allSettled([
    classesAPI.list(), subjectsAPI.list(), cbtAdminAPI.listExams(),
  ]);
  if (classResult.status === 'fulfilled') populateClasses(classResult.value?.data ?? classResult.value);
  if (subjectResult.status === 'fulfilled') populateSubjects(subjectResult.value?.data ?? subjectResult.value);
  if (examResult.status === 'fulfilled') exams = records(examResult.value, ['exams', 'items']);
  loadStudents();
}

function populateClasses(payload) {
  const classes = records(payload, ['classes', 'items']);
  for (const select of [$('classFilter'), $('subjectTeacherClass')]) {
    select.insertAdjacentHTML('beforeend', classes.map((item) => {
      const id = item.class_id ?? item.classId ?? item.id;
      const name = item.class_name ?? item.className ?? item.name ?? item.title;
      return id == null || !name ? '' : `<option value="${esc(id)}">${esc(name)}</option>`;
    }).join(''));
  }
}

function populateSubjects(payload) {
  const dbSubjects = records(payload, ['subjects', 'items']);
  const byId = new Map();
  for (const subject of [...dbSubjects, ...exams.map((exam) => ({
    subject_id: subjectIdOfExam(exam),
    subject_name: exam.subject_name ?? exam.subjectName ?? exam.subject?.subject_name ?? exam.subject?.name,
  }))]) {
    const id = idOf(subject);
    const name = subject.subject_name ?? subject.subjectName ?? subject.name ?? subject.title;
    if (id != null && name && !byId.has(String(id))) byId.set(String(id), { id, name });
  }
  const select = $('subjectTeacherSubject');
  select.innerHTML = '<option value="">Select a subject</option>' + [...byId.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ id, name }) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
}

function switchView(view) {
  const subject = view === 'subject';
  $('rosterView').hidden = subject;
  $('subjectView').hidden = !subject;
  document.querySelectorAll('[data-cbt-view]').forEach((button) => {
    const active = button.dataset.cbtView === view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (subject && $('subjectTeacherSubject').value && !subjectAttemptRows.length) loadSubjectAttempts();
}

async function loadStudents() {
  $('studentRows').innerHTML = '<tr><td colspan="8" class="cbt-empty">Loading students...</td></tr>';
  $('studentError').hidden = true;
  try {
    const response = await cbtAdminAPI.listStudents({ page, limit: PAGE_SIZE, search: $('studentSearch').value.trim(), classId: $('classFilter').value, status: $('statusFilter').value });
    const students = response.students || [];
    const pagination = response.pagination || {};
    page = Number(pagination.page || page);
    totalPages = Math.max(1, Number(pagination.totalPages || 1));
    $('studentTotal').textContent = Number(pagination.total ?? students.length).toLocaleString();
    $('pageSummary').textContent = `Page ${page} of ${totalPages} · ${Number(pagination.total ?? students.length).toLocaleString()} students`;
    $('previousPage').disabled = page <= 1;
    $('nextPage').disabled = page >= totalPages;
    if (!students.length) {
      $('studentRows').innerHTML = '<tr><td colspan="8" class="cbt-empty">No students match these filters.</td></tr>';
      return;
    }
    $('studentRows').innerHTML = students.map((student) => {
      const name = fullName(student);
      const latest = student.latest_submission_at ? new Date(student.latest_submission_at).toLocaleString() : '—';
      return `<tr><td data-label="Student"><strong>${esc(name || 'Unnamed student')}</strong></td><td data-label="Admission number">${esc(student.admission_number || '—')}</td><td data-label="Class">${esc(student.class_name || '—')}</td><td data-label="Status"><span class="roster-status">${esc(student.status || '—')}</span></td><td data-label="Attempts">${Number(student.attempt_count || 0)}</td><td data-label="Completed">${Number(student.completed_exam_count || 0)}</td><td data-label="Latest submission">${esc(latest)}</td><td data-label="Action"><a class="cbt-button cbt-button-secondary roster-action" href="/admin/cbt-student-results?studentId=${encodeURIComponent(student.student_id)}">View results</a></td></tr>`;
    }).join('');
  } catch (error) {
    $('studentRows').innerHTML = '<tr><td colspan="8" class="cbt-empty">Could not load students.</td></tr>';
    $('studentError').textContent = error.message || 'Could not load student roster.';
    $('studentError').hidden = false;
  }
}

async function loadSubjectAttempts() {
  subjectAttemptRows = [];
  const subjectId = $('subjectTeacherSubject').value;
  $('subjectAttemptCount').textContent = subjectId ? 'Loading attempts...' : 'Select a subject';
  $('subjectAttemptsError').hidden = true;
  if (!subjectId) {
    $('subjectAttemptsLoading').hidden = true;
    $('subjectAttemptRows').innerHTML = '<tr><td colspan="5" class="cbt-empty">Select a subject to load exam attempts.</td></tr>';
    return;
  }
  const subjectExams = exams.filter((exam) => String(subjectIdOfExam(exam) ?? '') === String(subjectId));
  if (!subjectExams.length) {
    $('subjectAttemptsLoading').hidden = true;
    $('subjectAttemptCount').textContent = '0 attempts';
    $('subjectAttemptRows').innerHTML = '<tr><td colspan="5" class="cbt-empty">No CBT exams are available for this subject.</td></tr>';
    return;
  }
  $('subjectAttemptsLoading').hidden = false;
  $('subjectAttemptRows').innerHTML = '';
  const results = await Promise.allSettled(subjectExams.map(async (exam) => ({
    exam,
    response: await cbtAdminAPI.listAttempts(exam.exam_id ?? exam.examId ?? exam.id),
  })));
  $('subjectAttemptsLoading').hidden = true;
  const failures = results.filter((item) => item.status === 'rejected');
  subjectAttemptRows = results.flatMap((item) => {
    if (item.status !== 'fulfilled') return [];
    const attempts = records(item.value.response, ['attempts', 'results', 'items']);
    return attempts.map((attempt) => ({ exam: item.value.exam, attempt }));
  });
  if (failures.length) {
    $('subjectAttemptsError').textContent = `Could not load attempts for ${failures.length} exam${failures.length === 1 ? '' : 's'}. Other available results are shown.`;
    $('subjectAttemptsError').hidden = false;
  }
  renderSubjectAttempts();
}

function renderSubjectAttempts() {
  const classId = $('subjectTeacherClass').value;
  const query = $('subjectTeacherSearch').value.trim().toLocaleLowerCase();
  const filtered = subjectAttemptRows.filter(({ exam, attempt }) => {
    const student = attempt.student ?? attempt.candidate ?? attempt;
    const attemptClassId = student.class_id ?? student.classId ?? student.class?.class_id ?? student.class?.id ?? attempt.class_id ?? attempt.classId;
    const className = student.class_name ?? student.className ?? student.class?.class_name ?? student.class?.name ?? attempt.class_name ?? attempt.className;
    const matchesClass = !classId || String(attemptClassId ?? '') === String(classId);
    const haystack = `${fullName(student)} ${student.admission_number ?? student.admissionNumber ?? ''} ${className ?? ''} ${exam.title ?? exam.name ?? ''}`.toLocaleLowerCase();
    return matchesClass && (!query || haystack.includes(query));
  });
  const uniqueStudents = new Set(filtered.map(({ attempt }) => {
    const student = attempt.student ?? attempt.candidate ?? attempt;
    return student.student_id ?? student.studentId ?? student.id ?? student.admission_number ?? student.admissionNumber;
  }).filter(Boolean));
  $('subjectAttemptCount').textContent = `${uniqueStudents.size} student${uniqueStudents.size === 1 ? '' : 's'} · ${filtered.length} attempt${filtered.length === 1 ? '' : 's'}`;
  if (!filtered.length) {
    $('subjectAttemptRows').innerHTML = `<tr><td colspan="5" class="cbt-empty">${subjectAttemptRows.length ? 'No students match these filters.' : 'No student attempts found for this subject.'}</td></tr>`;
    return;
  }
  $('subjectAttemptRows').innerHTML = filtered.map(({ exam, attempt }) => {
    const student = attempt.student ?? attempt.candidate ?? attempt;
    const name = fullName(student) || attempt.student_name || attempt.studentName || 'Unnamed student';
    const admission = student.admission_number ?? student.admissionNumber ?? attempt.admission_number ?? attempt.admissionNumber ?? '—';
    const className = student.class_name ?? student.className ?? student.class?.class_name ?? student.class?.name ?? attempt.class_name ?? attempt.className ?? '—';
    const score = attempt.score ?? attempt.total_score ?? attempt.totalScore;
    const maxScore = attempt.max_score ?? attempt.maxScore;
    const percentage = attempt.percentage ?? attempt.score_percentage ?? attempt.scorePercentage;
    const scoreText = score == null ? '—' : `${score}${maxScore == null ? '' : ` / ${maxScore}`}${percentage == null ? '' : ` (${percentage}%)`}`;
    const submitted = attempt.submitted_at ?? attempt.submittedAt ?? attempt.completed_at ?? attempt.completedAt;
    const submittedText = submitted ? new Date(submitted).toLocaleString() : '—';
    return `<tr><td data-label="Student"><strong>${esc(name)}</strong></td><td data-label="Admission number">${esc(admission)}</td><td data-label="Class">${esc(className)}</td><td data-label="CBT result"><strong>${esc(scoreText)}</strong></td><td data-label="Submitted">${esc(submittedText)}</td></tr>`;
  }).join('');
}
