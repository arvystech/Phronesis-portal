import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { cbtAdminAPI } from '../cbt-api.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const date = (value) => value ? new Date(value).toLocaleString() : '—';
let reviewQuestions = [];
let reviewIndex = 0;
let reviewTitle = '';
let resetAttemptId = null;

document.addEventListener('DOMContentLoaded', () => {
  setupLayout('cbt-students', 'Student exam results');
  createReviewModal();
  createResetModal();
  $('resultsContent').addEventListener('click', handleReviewClick);
  $('resultsContent').addEventListener('click', handleResetClick);
  requireAuth(loadResults);
});

async function loadResults() {
  const legacyMatch = window.location.pathname.match(/^\/admin\/cbt-students\/(\d+)\/results\/?$/);
  const studentId = new URLSearchParams(window.location.search).get('studentId') || legacyMatch?.[1];
  if (!studentId || !/^\d+$/.test(studentId)) return showError('The student ID in this page address is invalid.');
  try {
    const data = await cbtAdminAPI.getStudentResults(studentId);
    const student = data.student || {};
    const summary = data.summary || {};
    const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
    const results = data.results || [];
    $('resultsContent').innerHTML = `<div class="cbt-heading"><div><p class="cbt-eyebrow">STUDENT PROFILE</p><h2>${esc(fullName || 'Student')}</h2><p>${esc(student.admission_number || '—')} · ${esc(student.class_name || 'Class unavailable')} · ${esc(student.status || '—')}</p></div><span class="roster-status">${esc(student.status || '—')}</span></div><div class="result-summary"><div><strong>${Number(summary.totalAttempts || 0)}</strong><span>Total attempts</span></div><div><strong>${Number(summary.completedExams || 0)}</strong><span>Completed exams</span></div><div><strong>${Number(summary.inProgressExams || 0)}</strong><span>In progress</span></div></div><section class="cbt-panel"><div class="cbt-panel-heading"><div><span class="cbt-step">CBT</span><div><h3>Exam history</h3><p>Scores and attempt summaries for this student.</p></div></div></div>${results.length ? `<div class="result-list">${results.map(renderResult).join('')}</div>` : '<div class="cbt-empty">This student has not taken any CBT exams yet.</div>'}</section>`;
  } catch (error) {
    showError(error.message || 'Could not load this student’s exam history.');
  }
}

function renderResult(result) {
  const completed = result.status === 'submitted' || result.status === 'auto_submitted';
  const score = result.score == null ? 'Not scored' : `${result.score} / ${result.max_score ?? '—'}`;
  const percent = result.percentage == null ? '—' : `${result.percentage}%`;
  const duration = result.duration_seconds ? `${Math.round(result.duration_seconds / 60)} min` : '—';
  return `<article class="result-card"><div class="result-card-top"><div><h4>${esc(result.title || 'CBT exam')}</h4><p>${esc(result.subject_name || 'Subject unavailable')} · ${esc(result.class_name || 'Class unavailable')}${result.session_name ? ` · ${esc(result.session_name)}` : ''}${result.term_name ? ` · ${esc(result.term_name)}` : ''}</p></div><span class="roster-status ${completed ? 'is-complete' : 'is-progress'}">${esc((result.status || 'unknown').replaceAll('_', ' '))}</span></div><div class="result-metrics"><div><span>Score</span><strong>${esc(score)}</strong></div><div><span>Percentage</span><strong>${esc(percent)}</strong></div><div><span>Answered</span><strong>${Number(result.answered_count || 0)} / ${Number(result.question_count || 0)}</strong></div><div><span>Duration</span><strong>${esc(duration)}</strong></div></div><div class="result-dates"><span>Started: ${esc(date(result.started_at))}</span><span>Submitted: ${esc(date(result.submitted_at))}</span></div><div class="result-card-actions"><button class="cbt-button cbt-button-primary" type="button" data-review-attempt="${esc(result.attempt_id)}" data-review-title="${esc(result.title || 'CBT exam')}">Review questions</button><button class="cbt-button cbt-button-danger" type="button" data-reset-attempt="${esc(result.attempt_id)}" data-reset-title="${esc(result.title || 'CBT exam')}">Reset attempt</button></div></article>`;
}

function createResetModal() {
  const dialog = document.createElement('dialog');
  dialog.id = 'resetAttemptModal';
  dialog.className = 'question-review-modal';
  dialog.setAttribute('aria-labelledby', 'resetAttemptTitle');
  dialog.innerHTML = `<div class="reset-attempt-content"><header class="question-review-header"><div><p class="cbt-eyebrow">ATTEMPT MANAGEMENT</p><h2 id="resetAttemptTitle">Reset this attempt?</h2><p id="resetAttemptExam" class="cbt-modal-meta"></p></div><button id="closeResetAttempt" class="cbt-modal-close" type="button" aria-label="Close reset dialog">×</button></header><p class="reset-attempt-description">This voids the selected attempt and removes it from the student’s normal results. The student can start again while the exam is available. The existing attempt remains in the audit history.</p><div id="resetAttemptError" class="cbt-error" role="alert" hidden></div><footer class="question-review-footer"><button id="cancelResetAttempt" class="cbt-button cbt-button-secondary" type="button">Cancel</button><button id="confirmResetAttempt" class="cbt-button cbt-button-danger" type="button">Reset attempt</button></footer></div>`;
  document.body.append(dialog);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  $('closeResetAttempt').addEventListener('click', () => dialog.close());
  $('cancelResetAttempt').addEventListener('click', () => dialog.close());
  $('confirmResetAttempt').addEventListener('click', confirmAttemptReset);
}

function handleResetClick(event) {
  const button = event.target.closest('[data-reset-attempt]');
  if (!button) return;
  resetAttemptId = button.dataset.resetAttempt;
  $('resetAttemptExam').textContent = button.dataset.resetTitle || 'CBT exam';
  $('resetAttemptError').hidden = true;
  $('confirmResetAttempt').disabled = false;
  $('confirmResetAttempt').textContent = 'Reset attempt';
  $('resetAttemptModal').showModal();
}

async function confirmAttemptReset() {
  if (!resetAttemptId) return;
  const confirmButton = $('confirmResetAttempt');
  confirmButton.disabled = true;
  confirmButton.textContent = 'Resetting…';
  $('resetAttemptError').hidden = true;
  try {
    await cbtAdminAPI.resetAttempt(resetAttemptId);
    $('resetAttemptModal').close();
    await loadResults();
  } catch (error) {
    $('resetAttemptError').textContent = error.message || 'Could not reset this attempt.';
    $('resetAttemptError').hidden = false;
  } finally {
    resetAttemptId = null;
    confirmButton.disabled = false;
    confirmButton.textContent = 'Reset attempt';
  }
}

function createReviewModal() {
  const dialog = document.createElement('dialog');
  dialog.id = 'questionReviewModal';
  dialog.className = 'question-review-modal';
  dialog.setAttribute('aria-labelledby', 'reviewTitle');
  dialog.innerHTML = `<div class="question-review-content"><header class="question-review-header"><div><p class="cbt-eyebrow">ANSWER REVIEW</p><h2 id="reviewTitle">Question review</h2><p id="reviewExamTitle" class="cbt-modal-meta"></p></div><button id="closeQuestionReview" class="cbt-modal-close" type="button" aria-label="Close review">×</button></header><div id="reviewLoading" class="cbt-empty" hidden>Loading question review…</div><div id="reviewError" class="cbt-error" role="alert" hidden></div><div id="reviewView"><div class="question-review-progress"><span id="reviewPosition"></span><div class="question-review-track"><span id="reviewProgress"></span></div></div><article class="question-review-body"><h3 id="reviewQuestion"></h3><div id="reviewOptions" class="question-review-options"></div></article><footer class="question-review-footer"><button id="reviewPrevious" class="cbt-button cbt-button-secondary" type="button">← Previous</button><button id="reviewNext" class="cbt-button cbt-button-primary" type="button">Next →</button></footer></div></div>`;
  document.body.append(dialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  $('closeQuestionReview').addEventListener('click', () => dialog.close());
  $('reviewPrevious').addEventListener('click', () => moveReview(-1));
  $('reviewNext').addEventListener('click', () => moveReview(1));
}

async function handleReviewClick(event) {
  const button = event.target.closest('[data-review-attempt]');
  if (!button) return;
  const dialog = $('questionReviewModal');
  reviewTitle = button.dataset.reviewTitle || 'CBT exam';
  $('reviewExamTitle').textContent = reviewTitle;
  $('reviewError').hidden = true;
  $('reviewView').hidden = true;
  $('reviewLoading').hidden = false;
  dialog.showModal();
  button.disabled = true;
  try {
    const data = await cbtAdminAPI.getAttemptReview(button.dataset.reviewAttempt);
    reviewQuestions = Array.isArray(data.questions) ? data.questions : [];
    reviewIndex = 0;
    $('reviewLoading').hidden = true;
    if (!reviewQuestions.length) {
      $('reviewError').textContent = 'No question details were returned for this attempt.';
      $('reviewError').hidden = false;
      return;
    }
    $('reviewView').hidden = false;
    renderReviewQuestion();
  } catch (error) {
    $('reviewLoading').hidden = true;
    $('reviewError').textContent = error.message || 'Could not load question review.';
    $('reviewError').hidden = false;
  } finally {
    button.disabled = false;
  }
}

function renderReviewQuestion() {
  const question = reviewQuestions[reviewIndex];
  if (!question) return;
  const options = question.options || [];
  const selectedId = question.selectedOption?.optionId;
  const correctId = question.correctOption?.optionId;
  const selectedLabel = question.selectedOption?.label;
  const correctLabel = question.correctOption?.label;
  $('reviewPosition').textContent = `Question ${reviewIndex + 1} of ${reviewQuestions.length}`;
  $('reviewProgress').style.width = `${((reviewIndex + 1) / reviewQuestions.length) * 100}%`;
  $('reviewQuestion').textContent = question.prompt || 'Question text unavailable';
  $('reviewOptions').innerHTML = options.map((option) => {
    const isSelected = selectedId != null ? option.optionId === selectedId : option.label === selectedLabel;
    const isCorrect = option.isCorrect === true || (correctId != null ? option.optionId === correctId : option.label === correctLabel);
    const classes = ['question-review-option', isCorrect ? 'is-correct' : '', isSelected ? 'is-selected' : ''].filter(Boolean).join(' ');
    const tags = `${isSelected ? '<span class="review-option-tag">Student selected</span>' : ''}${isCorrect ? '<span class="review-option-tag">Correct answer</span>' : ''}`;
    return `<div class="${classes}"><span class="question-review-letter">${esc(option.label || '')}</span><span class="question-review-option-text">${esc(option.text || '')}</span><span class="question-review-tags">${tags}</span></div>`;
  }).join('');
  if (!question.selectedOption) {
    $('reviewOptions').insertAdjacentHTML('beforeend', '<p class="question-review-unanswered">Student left this question unanswered.</p>');
  }
  $('reviewPrevious').disabled = reviewIndex === 0;
  $('reviewNext').disabled = reviewIndex === reviewQuestions.length - 1;
  $('reviewNext').textContent = reviewIndex === reviewQuestions.length - 1 ? 'Last question' : 'Next →';
}

function moveReview(direction) {
  const nextIndex = reviewIndex + direction;
  if (nextIndex < 0 || nextIndex >= reviewQuestions.length) return;
  reviewIndex = nextIndex;
  renderReviewQuestion();
}

function showError(message) {
  $('resultsContent').innerHTML = `<div class="cbt-panel cbt-error" role="alert">${esc(message)}<p><a href="/admin/cbt-students">Return to student roster</a></p></div>`;
}
