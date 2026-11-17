import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { classesAPI, subjectsAPI } from '../api.js';
import { cbtAdminAPI } from '../cbt-api.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const DURATION_SECONDS = 30 * 60;
let questionSequence = 0;
let toastTimer;
let editingExamId = null;
let editingExam = null;
let archivingExamId = null;
let exams = [];
let classRecords = [];
let subjectRecords = [];

document.addEventListener('DOMContentLoaded', () => {
  setupLayout('cbt', 'CBT Questions');
  requireAuth(initCbtPage);
});

async function initCbtPage() {
  document.getElementById('addQuestionBtn').addEventListener('click', () => addQuestion());
  document.getElementById('questionList').addEventListener('click', removeQuestion);
  document.getElementById('editQuestionList').addEventListener('click', removeQuestion);
  document.getElementById('questionForm').addEventListener('submit', createExam);
  document.getElementById('editSetForm').addEventListener('submit', saveEditedExam);
  document.getElementById('addModalQuestion').addEventListener('click', () => addQuestion('editQuestionList'));
  document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
  document.getElementById('closeAttemptsModal').addEventListener('click', () => document.getElementById('attemptsModal').close());
  document.getElementById('cancelArchiveBtn').addEventListener('click', () => { document.getElementById('archiveModal').close(); archivingExamId = null; });
  document.getElementById('confirmArchiveBtn').addEventListener('click', archiveExam);
  document.getElementById('savedSubjectFilter').addEventListener('change', renderExams);
  document.getElementById('savedSets').addEventListener('click', handleExamAction);
  addQuestion();
  await loadPageData();
}

async function loadPageData() {
  try {
    const [classResponse, subjectResponse, examResponse] = await Promise.all([
      classesAPI.list(), subjectsAPI.list(), cbtAdminAPI.listExams(),
    ]);
    classRecords = extractRecords(classResponse, ['classes', 'data', 'results']);
    subjectRecords = extractRecords(subjectResponse, ['subjects', 'data', 'results']);
    exams = extractRecords(examResponse, ['exams', 'data', 'results']);
    populateLookup('classSelect', classRecords, ['class_id', 'id'], ['class_name', 'className', 'class', 'name', 'title'], 'No classes available');
    populateLookup('subjectSelect', subjectRecords, ['subject_id', 'id'], ['subject_name', 'subjectName', 'subject', 'name', 'title'], 'No subjects available');
    renderExams();
  } catch (error) {
    notify(errorMessage(error, 'Could not load CBT data. Check the backend connection and try again.'));
    document.getElementById('savedSets').innerHTML = `<div class="cbt-empty">${escapeHtml(errorMessage(error, 'Could not load exams.'))}</div>`;
  }
}

function extractRecords(response, keys) {
  let value = response?.data ?? response;
  for (let depth = 0; depth < 3 && value; depth += 1) {
    for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
    if (Array.isArray(value)) return value;
    value = value.data;
  }
  return [];
}

function populateLookup(selectId, records, idKeys, nameKeys, emptyLabel) {
  const select = document.getElementById(selectId);
  const options = records.map((record) => {
    const id = firstDefined(record, idKeys);
    const name = firstDefined(record, nameKeys);
    return id != null && name ? new Option(String(name), String(id)) : null;
  }).filter(Boolean);
  select.replaceChildren(new Option(options.length ? 'Select an option' : emptyLabel, ''), ...options);
  select.disabled = options.length === 0;
}

function firstDefined(record, keys) {
  for (const key of keys) if (record?.[key] !== undefined && record?.[key] !== null) return record[key];
  return null;
}

function removeQuestion(event) {
  const remove = event.target.closest('[data-remove-question]');
  if (remove) { remove.closest('.cbt-question-card').remove(); renumberQuestions(remove.closest('.cbt-question-list').id); }
}

function addQuestion(listId = 'questionList', values = null) {
  const id = `question-${++questionSequence}`;
  const card = document.createElement('article');
  card.className = 'cbt-question-card';
  card.innerHTML = `<div class="cbt-question-top"><span class="cbt-question-number"></span><button class="cbt-remove" type="button" data-remove-question>Remove question</button></div>
    <div class="cbt-field"><label for="${id}-prompt">Question</label><textarea id="${id}-prompt" data-prompt maxlength="1200" placeholder="Type the question here…" required></textarea></div>
    <p class="cbt-options-title">Answer options <span class="cbt-correct-hint">· Select the circle beside the correct answer</span></p>
    <div class="cbt-options-grid">${LETTERS.map((letter) => `<label class="cbt-option"><input type="radio" name="${id}-correct" value="${letter}" ${values?.correctOption === letter ? 'checked' : (!values?.correctOption && letter === 'A' ? 'checked' : '')} aria-label="Mark option ${letter} correct"><span>${letter}</span><input type="text" data-option="${letter}" maxlength="400" placeholder="Option ${letter}" aria-label="Option ${letter}" required></label>`).join('')}</div>`;
  card.querySelector('[data-prompt]').value = values?.prompt || '';
  LETTERS.forEach((letter) => { card.querySelector(`[data-option="${letter}"]`).value = values?.options?.[letter] || ''; });
  document.getElementById(listId).append(card);
  renumberQuestions(listId);
}

function renumberQuestions(listId = 'questionList') {
  document.querySelectorAll(`#${listId} .cbt-question-card`).forEach((card, index) => {
    card.querySelector('.cbt-question-number').textContent = `QUESTION ${String(index + 1).padStart(2, '0')}`;
  });
}

function collectQuestions(listId) {
  const cards = [...document.querySelectorAll(`#${listId} .cbt-question-card`)];
  if (!cards.length) { notify('Add at least one question.'); return null; }
  const questions = [];
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const prompt = card.querySelector('[data-prompt]').value.trim();
    const options = Object.fromEntries(LETTERS.map((letter) => [letter, card.querySelector(`[data-option="${letter}"]`).value.trim()]));
    if (!prompt || LETTERS.some((letter) => !options[letter])) {
      notify(`Complete the question and all four options for question ${index + 1}.`);
      card.querySelector(':invalid')?.focus();
      return null;
    }
    const correctOption = card.querySelector('input[type="radio"]:checked')?.value;
    questions.push({ prompt, options: LETTERS.map((label) => ({ label, text: options[label], isCorrect: correctOption === label })) });
  }
  return questions;
}

function selectedIds() {
  const classId = Number(document.getElementById('classSelect').value);
  const subjectId = Number(document.getElementById('subjectSelect').value);
  if (!Number.isInteger(classId) || classId <= 0) { notify('Select a valid class from the school records.'); return null; }
  if (!Number.isInteger(subjectId) || subjectId <= 0) { notify('Select a valid subject from the school records.'); return null; }
  return { classId, subjectId };
}

async function createExam(event) {
  event.preventDefault();
  const ids = selectedIds();
  if (!ids) return;
  const questions = collectQuestions('questionList');
  if (!questions) return;
  const className = document.getElementById('classSelect').selectedOptions[0]?.textContent;
  const subjectName = document.getElementById('subjectSelect').selectedOptions[0]?.textContent;
  const payload = { ...ids, title: `${className} · ${subjectName}`, durationSeconds: DURATION_SECONDS, questions };
  try {
    await cbtAdminAPI.createExam(payload);
    document.getElementById('questionList').replaceChildren();
    addQuestion();
    await refreshExams();
    notify('Draft exam created successfully.');
  } catch (error) { notify(errorMessage(error, 'Could not create the exam.')); }
}

async function refreshExams() {
  const response = await cbtAdminAPI.listExams();
  exams = extractRecords(response, ['exams', 'data', 'results']);
  renderExams();
}

function examId(exam) { return firstDefined(exam, ['exam_id', 'examId', 'id']); }
function examClass(exam) { return firstDefined(exam, ['class_name', 'className']) || 'Class'; }
function examSubject(exam) { return firstDefined(exam, ['subject_name', 'subjectName']) || 'Subject'; }
function examStatus(exam) { return String(firstDefined(exam, ['status']) || 'draft').toLowerCase(); }

function renderExams() {
  const filter = document.getElementById('savedSubjectFilter');
  const selected = filter.value;
  const subjects = [...new Set(exams.map(examSubject))].sort((a, b) => a.localeCompare(b));
  filter.replaceChildren(new Option('All subjects', ''), ...subjects.map((subject) => new Option(subject, subject)));
  if (subjects.includes(selected)) filter.value = selected;
  const visible = filter.value ? exams.filter((exam) => examSubject(exam) === filter.value) : exams;
  document.getElementById('questionCount').textContent = exams.reduce((total, exam) => total + Number(firstDefined(exam, ['question_count', 'questionCount']) || 0), 0);
  const container = document.getElementById('savedSets');
  if (!visible.length) { container.innerHTML = '<div class="cbt-empty">No exams found. Create your first draft above.</div>'; return; }
  container.innerHTML = visible.map((exam) => {
    const id = escapeHtml(examId(exam));
    const status = examStatus(exam);
    const count = Number(firstDefined(exam, ['question_count', 'questionCount']) || 0);
    const statusClass = status === 'published' ? 'cbt-status-published' : status === 'closed' ? 'cbt-status-closed' : 'cbt-status-draft';
    const edit = status === 'draft' ? `<button class="cbt-view-set" type="button" data-edit-exam="${id}">View / edit</button>` : '';
    const publish = status === 'draft' ? `<button class="cbt-action-publish" type="button" data-publish-exam="${id}">Publish</button>` : '';
    const close = status === 'published' ? `<button class="cbt-action-close" type="button" data-close-exam="${id}">Close</button>` : '';
    return `<article class="cbt-set-row"><div class="cbt-set-info"><p class="cbt-set-title">${escapeHtml(examClass(exam))} · ${escapeHtml(examSubject(exam))}</p><p class="cbt-set-meta">${count} questions · ${escapeHtml(status)} · ${escapeHtml(firstDefined(exam, ['title']) || '')}</p></div><div class="cbt-set-actions">${edit}<button class="cbt-view-set" type="button" data-attempts-exam="${id}">Attempts</button>${publish}${close}<button class="cbt-delete-set" type="button" data-archive-exam="${id}">Archive</button></div><span class="cbt-status ${statusClass}">${escapeHtml(status)}</span></article>`;
  }).join('');
}

async function handleExamAction(event) {
  const button = event.target.closest('[data-edit-exam],[data-attempts-exam],[data-publish-exam],[data-close-exam],[data-archive-exam]');
  if (!button) return;
  const id = button.dataset.editExam || button.dataset.attemptsExam || button.dataset.publishExam || button.dataset.closeExam || button.dataset.archiveExam;
  button.disabled = true;
  try {
    if (button.dataset.editExam) await openEditModal(id);
    else if (button.dataset.attemptsExam) await openAttemptsModal(id);
    else if (button.dataset.publishExam) { await cbtAdminAPI.publishExam(id); notify('Exam published.'); await refreshExams(); }
    else if (button.dataset.closeExam) { await cbtAdminAPI.closeExam(id); notify('Exam closed to new attempts.'); await refreshExams(); }
    else if (button.dataset.archiveExam) {
      archivingExamId = id;
      document.getElementById('archiveModal').showModal();
    }
  } catch (error) { notify(errorMessage(error, 'Could not complete this action.')); }
  finally { if (button.isConnected) button.disabled = false; }
}

async function archiveExam() {
  if (!archivingExamId) return;
  const button = document.getElementById('confirmArchiveBtn');
  button.disabled = true;
  try {
    await cbtAdminAPI.archiveExam(archivingExamId);
    document.getElementById('archiveModal').close();
    archivingExamId = null;
    notify('Exam archived.');
    await refreshExams();
  } catch (error) { notify(errorMessage(error, 'Could not archive the exam.')); }
  finally { button.disabled = false; }
}

function normalizeQuestion(question) {
  const rawOptions = question.options || question.answers || [];
  const options = Array.isArray(rawOptions)
    ? Object.fromEntries(rawOptions.map((option) => [String(option.label || '').toUpperCase(), option.text || '']))
    : rawOptions;
  const correct = Array.isArray(rawOptions)
    ? rawOptions.find((option) => option.isCorrect || option.is_correct)?.label
    : question.correctOption || question.correct_option;
  return {
    prompt: question.prompt || question.question_text || question.question || '',
    options,
    correctOption: String(correct || 'A').toUpperCase(),
  };
}

async function openEditModal(id) {
  const response = await cbtAdminAPI.getExam(id);
  editingExam = response?.exam || response?.data?.exam || response?.data || response;
  editingExamId = firstDefined(editingExam, ['exam_id', 'examId', 'id']) || id;
  if (examStatus(editingExam) !== 'draft') throw new Error('Only draft exams can be edited.');
  const title = editingExam.title || `${examClass(editingExam)} · ${examSubject(editingExam)}`;
  document.getElementById('editModalTitle').textContent = title;
  const questions = editingExam.questions || editingExam.items || [];
  document.getElementById('editModalMeta').textContent = `${questions.length} questions · Drafts can be edited before publishing.`;
  const list = document.getElementById('editQuestionList');
  list.replaceChildren();
  questions.forEach((question) => addQuestion('editQuestionList', normalizeQuestion(question)));
  if (!questions.length) addQuestion('editQuestionList');
  const classId = firstDefined(editingExam, ['class_id', 'classId']);
  const subjectId = firstDefined(editingExam, ['subject_id', 'subjectId']);
  if (classId != null) document.getElementById('classSelect').value = String(classId);
  if (subjectId != null) document.getElementById('subjectSelect').value = String(subjectId);
  document.getElementById('editSetModal').showModal();
}

function closeEditModal() {
  document.getElementById('editSetModal').close();
  editingExamId = null;
  editingExam = null;
}

async function saveEditedExam(event) {
  event.preventDefault();
  if (!editingExamId || !editingExam) return;
  const ids = selectedIds();
  if (!ids) return;
  const questions = collectQuestions('editQuestionList');
  if (!questions) return;
  const className = document.getElementById('classSelect').selectedOptions[0]?.textContent;
  const subjectName = document.getElementById('subjectSelect').selectedOptions[0]?.textContent;
  const payload = {
    ...ids,
    title: editingExam.title || `${className} · ${subjectName}`,
    durationSeconds: Number(firstDefined(editingExam, ['duration_seconds', 'durationSeconds']) || DURATION_SECONDS),
    questions,
  };
  const sessionId = editingExam.sessionId ?? editingExam.session_id;
  const termId = editingExam.termId ?? editingExam.term_id;
  const availableFrom = editingExam.availableFrom ?? editingExam.available_from;
  const availableUntil = editingExam.availableUntil ?? editingExam.available_until;
  if (sessionId != null) payload.sessionId = Number(sessionId);
  if (termId != null) payload.termId = Number(termId);
  if (availableFrom != null) payload.availableFrom = availableFrom;
  if (availableUntil != null) payload.availableUntil = availableUntil;
  try {
    await cbtAdminAPI.updateExam(editingExamId, payload);
    closeEditModal();
    await refreshExams();
    notify('Draft exam updated.');
  } catch (error) { notify(errorMessage(error, 'Could not save exam changes.')); }
}

async function openAttemptsModal(id) {
  const exam = exams.find((item) => String(examId(item)) === String(id));
  document.getElementById('attemptsModalTitle').textContent = `Attempts · ${examClass(exam || {})} · ${examSubject(exam || {})}`;
  document.getElementById('attemptsModalMeta').textContent = 'Scores and submission status returned by the backend.';
  const container = document.getElementById('attemptsList');
  container.innerHTML = '<div class="cbt-empty">Loading attempts…</div>';
  document.getElementById('attemptsModal').showModal();
  let attempts;
  try {
    const response = await cbtAdminAPI.listAttempts(id);
    attempts = extractRecords(response, ['attempts', 'data', 'results']);
  } catch (error) {
    container.innerHTML = `<div class="cbt-empty">${escapeHtml(errorMessage(error, 'Could not load attempts.'))}</div>`;
    throw error;
  }
  if (!attempts.length) { container.innerHTML = '<div class="cbt-empty">No student attempts for this exam yet.</div>'; return; }
  container.innerHTML = attempts.map((attempt) => `<article class="cbt-set-row"><div class="cbt-set-info"><p class="cbt-set-title">${escapeHtml(firstDefined(attempt, ['student_name', 'studentName', 'student_id', 'studentId']) || attempt.student?.name || attempt.student?.student_id || 'Student')}</p><p class="cbt-set-meta">${escapeHtml(firstDefined(attempt, ['status']) || '—')} · Submitted ${escapeHtml(formatDate(firstDefined(attempt, ['submitted_at', 'submittedAt'])))}</p></div><strong>${escapeHtml(firstDefined(attempt, ['score', 'marks']) ?? '—')} / ${escapeHtml(firstDefined(attempt, ['max_score', 'maxScore']) ?? '—')}</strong></article>`).join('');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function errorMessage(error, fallback) {
  if (error.status === 401) return 'Your admin session has expired. Sign in again.';
  if (error.status === 403) return error.message || 'You do not have permission to manage CBT exams.';
  return error.message || fallback;
}
function notify(message) {
  const toast = document.getElementById('cbtToast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000);
}
