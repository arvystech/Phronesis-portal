import { cbtStudentAPI } from './api.js';

const ATTEMPT_KEY = 'phronesis_cbt_attempt_id_v1';
const LETTERS = ['A', 'B', 'C', 'D'];
const ACCESS_REDIRECT_DELAY_MS = 5000;
let availableExams = [];
let student = null;
let admissionNumber = '';
let activeExam = null;
let attemptId = null;
let currentQuestion = 0;
let answers = {};
let pendingAnswers = {};
let answerSaveSequence = 0;
let deadline = 0;
let serverOffsetMs = 0;
let timerInterval = null;
let submitted = false;
let submitting = false;

const elements = Object.fromEntries([
  'accessView', 'accessForm', 'admissionNumber', 'studentAccessFields', 'examPicker', 'examSelect', 'checkExamsBtn', 'beginExamBtn', 'changeStudentBtn', 'accessMessage', 'examView', 'examTitle', 'timerBox', 'timerDisplay', 'candidateId', 'candidateClass', 'candidateSubject', 'progressDisplay', 'questionNumber', 'questionPrompt', 'optionsList', 'answerSaveStatus', 'previousBtn', 'nextBtn', 'questionGrid', 'submitExamBtn', 'confirmationView', 'confirmationMessage', 'confirmationId', 'confirmationClass', 'confirmationSubject', 'submittedAt', 'submitModal', 'submitModalMessage', 'cancelSubmitBtn', 'confirmSubmitBtn', 'redirectMessage',
].map((id) => [id, document.getElementById(id)]));

document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  elements.accessForm.addEventListener('submit', verifyStudentAccess);
  elements.beginExamBtn.addEventListener('click', startExam);
  elements.changeStudentBtn.addEventListener('click', changeCandidate);
  elements.previousBtn.addEventListener('click', previousQuestion);
  elements.nextBtn.addEventListener('click', nextQuestion);
  elements.submitExamBtn.addEventListener('click', openSubmitModal);
  elements.cancelSubmitBtn.addEventListener('click', () => elements.submitModal.close());
  elements.confirmSubmitBtn.addEventListener('click', submitFromModal);
  elements.questionGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-question-index]');
    if (button) { currentQuestion = Number(button.dataset.questionIndex); renderQuestion(); }
  });
  elements.optionsList.addEventListener('click', (event) => {
    const retry = event.target.closest('[data-retry-question]');
    if (retry) { retryAnswer(retry.dataset.retryQuestion); return; }
    const option = event.target.closest('[data-option-id]');
    if (option) saveAnswer(option.dataset.optionId);
  });
  document.addEventListener('keydown', handleShortcuts);
  window.addEventListener('beforeunload', protectActiveAttempt);
  elements.submitModal.addEventListener('click', (event) => {
    if (event.target === elements.submitModal) elements.submitModal.close();
  });
  await resumeAttempt();
}

function extractList(response, keys) {
  const body = response?.data ?? response;
  for (const key of keys) if (Array.isArray(body?.[key])) return body[key];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

async function verifyStudentAccess(event) {
  event.preventDefault();
  const enteredAdmissionNumber = elements.admissionNumber.value.trim();
  if (!enteredAdmissionNumber) {
    setAccessMessage('Enter your admission number to continue.');
    return;
  }
  elements.checkExamsBtn.disabled = true;
  setAccessMessage('Checking your admission number…');
  try {
    const response = await cbtStudentAPI.access(enteredAdmissionNumber);
    const result = response.data && !Array.isArray(response.data) ? response.data : response;
    student = result.student || result.candidate || null;
    admissionNumber = student?.admissionNumber || student?.admission_number || student?.studentId || student?.student_id || enteredAdmissionNumber;
    const examResponse = await cbtStudentAPI.listExams();
    const examData = examResponse.data && !Array.isArray(examResponse.data) ? examResponse.data : examResponse;
    student = examData.student || examData.candidate || student;
    availableExams = extractList(examData, ['exams', 'availableExams', 'available_exams']);
    populateExamChoices();
    if (!availableExams.length) {
      setAccessMessage('No published exams are currently assigned to your class.');
      elements.checkExamsBtn.disabled = false;
      return;
    }
    elements.studentAccessFields.classList.add('hidden');
    elements.examPicker.classList.remove('hidden');
    setAccessMessage('');
  } catch (error) {
    setAccessMessage(error.status === 404 || error.status === 403
      ? error.message || 'That admission number could not be verified.'
      : errorMessage(error, 'Could not verify the admission number. Check it and try again.'));
    elements.checkExamsBtn.disabled = false;
  }
}

function populateExamChoices() {
  elements.examSelect.replaceChildren(new Option(availableExams.length ? 'Select an available exam' : 'No exams available', ''));
  availableExams.forEach((exam) => {
    const id = exam.exam_id ?? exam.examId ?? exam.id;
    if (id == null) return;
    const className = exam.class_name || exam.className || exam.class || 'Class';
    const subject = exam.subject_name || exam.subjectName || exam.subject || 'Subject';
    const count = exam.question_count ?? exam.questionCount;
    elements.examSelect.add(new Option(`${className} · ${subject}${count ? ` (${count} questions)` : ''}`, String(id)));
  });
  elements.beginExamBtn.disabled = !availableExams.length;
}

async function changeCandidate() {
  try { await cbtStudentAPI.logoutCandidate(); } catch (_) { /* Let the student switch even if candidate-session cleanup fails. */ }
  elements.examPicker.classList.add('hidden');
  elements.studentAccessFields.classList.remove('hidden');
  elements.admissionNumber.value = '';
  elements.checkExamsBtn.disabled = false;
  availableExams = [];
  student = null;
  admissionNumber = '';
  setAccessMessage('');
}

async function startExam() {
  const selectedExam = availableExams.find((exam) => String(exam.exam_id ?? exam.examId ?? exam.id) === elements.examSelect.value);
  if (!selectedExam) { setAccessMessage('Select an available exam first.'); return; }
  requestExamFullscreen();
  elements.beginExamBtn.disabled = true;
  setAccessMessage('Starting your exam…');
  try {
    const response = await cbtStudentAPI.startAttempt(selectedExam.exam_id ?? selectedExam.examId ?? selectedExam.id);
    const attempt = response.attempt || response.data?.attempt || response.data || response;
    setActiveAttempt(attempt, selectedExam);
    sessionStorage.setItem(ATTEMPT_KEY, String(attemptId));
    sessionStorage.setItem('phronesis_cbt_admission_number_v1', admissionNumber);
    setAccessMessage('');
    showExam();
  } catch (error) {
    setAccessMessage(errorMessage(error, 'Could not start this exam.'));
    elements.beginExamBtn.disabled = false;
    exitExamFullscreen();
  }
}

function requestExamFullscreen() {
  try {
    const fullscreenRequest = document.documentElement.requestFullscreen?.();
    if (fullscreenRequest?.catch) fullscreenRequest.catch(() => {});
  } catch (_) { /* Fullscreen may be unavailable or blocked by the browser. */ }
}

function exitExamFullscreen() {
  if (!document.fullscreenElement) return;
  try {
    const exitRequest = document.exitFullscreen?.();
    if (exitRequest?.catch) exitRequest.catch(() => {});
  } catch (_) { /* Ignore browsers that do not expose the Fullscreen API. */ }
}

function setActiveAttempt(attempt, selectedExam = {}) {
  student = attempt.student || attempt.candidate || student;
  attemptId = attempt.attempt_id ?? attempt.attemptId ?? attempt.id;
  if (attemptId == null) throw new Error('The backend did not return an attempt ID.');
  const exam = attempt.exam || attempt;
  activeExam = {
    ...selectedExam,
    ...exam,
    className: exam.class_name || exam.className || exam.class || selectedExam.class_name || selectedExam.className || selectedExam.class || 'Class',
    subject: exam.subject_name || exam.subjectName || exam.subject || selectedExam.subject_name || selectedExam.subjectName || selectedExam.subject || 'Subject',
    questions: (attempt.questions || exam.questions || []).map(normalizeQuestion),
    expiresAt: attempt.expires_at || attempt.expiresAt,
    serverTime: attempt.serverTime || attempt.server_time,
  };
  if (!activeExam.questions.length) throw new Error('This exam has no questions.');
  const serverTime = Date.parse(activeExam.serverTime);
  serverOffsetMs = Number.isFinite(serverTime) ? serverTime - Date.now() : 0;
  deadline = Date.parse(activeExam.expiresAt);
  if (!Number.isFinite(deadline)) throw new Error('The backend did not return a valid exam expiry time.');
  currentQuestion = 0;
  answers = {};
  pendingAnswers = {};
  activeExam.questions.forEach((question, index) => {
    if (question.selectedOptionId != null) answers[question.id] = String(question.selectedOptionId);
    if (question.position != null && question.position - 1 >= 0) question.position = question.position - 1;
    else question.position = index;
  });
  const saved = Number(attempt.currentQuestion ?? attempt.current_question);
  if (Number.isInteger(saved)) currentQuestion = Math.min(Math.max(0, saved), activeExam.questions.length - 1);
  submitted = false;
  submitting = false;
}

function normalizeQuestion(question, index) {
  const options = Array.isArray(question.options) ? question.options : [];
  return {
    id: String(question.questionId ?? question.question_id ?? question.id ?? index),
    prompt: question.prompt || question.question_text || '',
    position: Number(question.position || index + 1),
    selectedOptionId: question.selectedOptionId ?? question.selected_option_id ?? null,
    options: options.map((option) => ({
      id: String(option.optionId ?? option.option_id ?? option.id),
      label: String(option.label || '').toUpperCase(),
      text: option.text || '',
    })),
  };
}

function showExam() {
  elements.accessView.classList.add('hidden');
  elements.confirmationView.classList.add('hidden');
  elements.examView.classList.remove('hidden');
  elements.examTitle.textContent = `${activeExam.className} · ${activeExam.subject}`;
  elements.candidateId.textContent = admissionNumber || student?.student_no || student?.studentNo || student?.student_id || student?.studentId || student?.admission_number || student?.admissionNumber || student?.name || student?.full_name || 'Verified student';
  elements.candidateClass.textContent = activeExam.className;
  elements.candidateSubject.textContent = activeExam.subject;
  elements.questionGrid.innerHTML = activeExam.questions.map((_, index) => `<button class="question-jump" type="button" data-question-index="${index}" aria-label="Go to question ${index + 1}">${index + 1}</button>`).join('');
  renderQuestion();
  updateTimer();
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
}

function currentQuestionData() { return activeExam?.questions[currentQuestion]; }
function selectedOptionFor(question) {
  const pending = pendingAnswers[question.id];
  return pending ? pending.optionId : answers[question.id];
}

function renderQuestion() {
  const question = currentQuestionData();
  if (!question) return;
  elements.questionNumber.textContent = `QUESTION ${String(currentQuestion + 1).padStart(2, '0')}`;
  elements.questionPrompt.textContent = question.prompt;
  elements.progressDisplay.textContent = `Question ${currentQuestion + 1} of ${activeExam.questions.length}`;
  const selectedId = selectedOptionFor(question);
  const pending = pendingAnswers[question.id];
  elements.optionsList.innerHTML = question.options.map((option) => {
    const selected = selectedId === option.id;
    const state = selected && pending?.state === 'saving' ? ' saving' : selected && pending?.state === 'failed' ? ' save-failed' : '';
    return `<button class="answer-option${selected ? ' selected' : ''}${state}" type="button" data-option-id="${escapeHtml(option.id)}" data-label="${escapeHtml(option.label)}" aria-pressed="${selected}" ${pending?.state === 'saving' ? 'disabled' : ''}><span class="option-letter">${escapeHtml(option.label)}</span><span class="option-text"></span><kbd>${escapeHtml(option.label)}</kbd></button>`;
  }).join('');
  [...elements.optionsList.querySelectorAll('.answer-option')].forEach((button, index) => {
    button.querySelector('.option-text').textContent = question.options[index].text;
  });
  if (pending?.state === 'saving') setAnswerSaveStatus('Saving your answer…', 'pending');
  else if (pending?.state === 'failed') {
    elements.answerSaveStatus.innerHTML = `<span>Answer not saved. Check your connection and retry.</span> <button class="answer-retry" type="button" data-retry-question="${escapeHtml(question.id)}">Retry save</button>`;
    elements.answerSaveStatus.className = 'answer-save-status error';
  } else {
    setAnswerSaveStatus('', '');
  }
  elements.questionGrid.querySelectorAll('[data-question-index]').forEach((button, index) => {
    const item = activeExam.questions[index];
    button.classList.toggle('current', index === currentQuestion);
    button.classList.toggle('answered', Boolean(answers[item.id]));
    button.setAttribute('aria-current', index === currentQuestion ? 'step' : 'false');
  });
  elements.previousBtn.disabled = currentQuestion === 0;
  elements.nextBtn.disabled = currentQuestion === activeExam.questions.length - 1;
}

function setAnswerSaveStatus(message, state) {
  elements.answerSaveStatus.textContent = message;
  elements.answerSaveStatus.className = `answer-save-status ${state || ''}`;
}

async function saveAnswer(optionId) {
  if (submitted || submitting) return;
  const question = currentQuestionData();
  if (!question || pendingAnswers[question.id]?.state === 'saving') return;
  const selected = question.options.find((option) => option.id === String(optionId));
  if (!selected) return;
  const requestId = ++answerSaveSequence;
  pendingAnswers[question.id] = { optionId: selected.id, state: 'saving', requestId };
  renderQuestion();
  try {
    await cbtStudentAPI.saveAnswer(attemptId, question.id, selected.id);
    if (pendingAnswers[question.id]?.requestId !== requestId) return;
    answers[question.id] = selected.id;
    delete pendingAnswers[question.id];
    renderQuestion();
    setAnswerSaveStatus('Answer saved.', 'saved');
  } catch (error) {
    if (pendingAnswers[question.id]?.requestId !== requestId) return;
    pendingAnswers[question.id].state = 'failed';
    renderQuestion();
    if (error.status === 409) setAnswerSaveStatus(error.message || 'This attempt has expired or is already submitted.', 'error');
  }
}

function retryAnswer(questionId) {
  const pending = pendingAnswers[questionId];
  if (!pending || pending.state !== 'failed') return;
  const questionIndex = activeExam.questions.findIndex((question) => question.id === questionId);
  if (questionIndex < 0) return;
  currentQuestion = questionIndex;
  const selected = pending.optionId;
  delete pendingAnswers[questionId];
  saveAnswer(selected);
}

function hasPendingAnswers() { return Object.values(pendingAnswers).some((pending) => pending.state === 'saving'); }
function hasFailedAnswers() { return Object.values(pendingAnswers).some((pending) => pending.state === 'failed'); }

function previousQuestion() {
  if (currentQuestion > 0) { currentQuestion -= 1; renderQuestion(); }
}
function nextQuestion() {
  if (currentQuestion < activeExam.questions.length - 1) { currentQuestion += 1; renderQuestion(); }
}

function handleShortcuts(event) {
  const reloadKey = event.key.toLowerCase();
  const isReloadShortcut = event.key === 'F5' || ((event.ctrlKey || event.metaKey) && reloadKey === 'r');
  if (isReloadShortcut && attemptId && !submitted && !elements.examView.classList.contains('hidden')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (elements.examView.classList.contains('hidden') || submitted || submitting || event.altKey || event.ctrlKey || event.metaKey) return;
  if (elements.submitModal.open) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
  const key = event.key.toUpperCase();
  if (key === 'N') { event.preventDefault(); nextQuestion(); }
  else if (key === 'P') { event.preventDefault(); previousQuestion(); }
  else if (LETTERS.includes(key)) {
    const option = currentQuestionData()?.options.find((item) => item.label === key);
    if (option) { event.preventDefault(); saveAnswer(option.id); }
  } else if (key === 'S') { event.preventDefault(); openSubmitModal(); }
}

function protectActiveAttempt(event) {
  if (!attemptId || submitted || elements.examView.classList.contains('hidden')) return;
  event.preventDefault();
  event.returnValue = '';
}

function updateTimer() {
  if (submitted || !deadline) return;
  const secondsLeft = Math.max(0, Math.ceil((deadline - (Date.now() + serverOffsetMs)) / 1000));
  elements.timerDisplay.textContent = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  elements.timerBox.classList.toggle('timer-warning', secondsLeft <= 300);
  if (secondsLeft <= 0 && !submitting) submitAttempt(true);
}

function openSubmitModal() {
  if (submitted || !activeExam || submitting) return;
  if (hasPendingAnswers() || hasFailedAnswers()) {
    setAnswerSaveStatus('Wait for every answer to save. Retry any answer that failed before submitting.', 'error');
    return;
  }
  const unanswered = activeExam.questions.length - Object.keys(answers).length;
  const detail = unanswered ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered.` : 'You have answered every question.';
  elements.submitModalMessage.textContent = `${detail} Once submitted, you cannot change your answers.`;
  elements.confirmSubmitBtn.disabled = false;
  elements.submitModal.showModal();
  elements.cancelSubmitBtn.focus();
}

async function submitFromModal() {
  if (hasPendingAnswers() || hasFailedAnswers()) {
    elements.submitModalMessage.textContent = 'Please wait for every answer to save and retry any failed answer before submitting.';
    return;
  }
  elements.submitModal.close();
  await submitAttempt(false);
}

async function submitAttempt(automatic) {
  if (submitted || submitting || !attemptId) return;
  submitting = true;
  elements.submitExamBtn.disabled = true;
  try {
    const response = await cbtStudentAPI.submitAttempt(attemptId);
    const result = response.attempt || response.data?.attempt || response.data || response;
    submitted = true;
    submitting = false;
    exitExamFullscreen();
    clearInterval(timerInterval);
    try { await cbtStudentAPI.logoutCandidate(); } catch (_) { /* Submission is already final; cleanup failure must not hide confirmation. */ }
    if (elements.submitModal.open) elements.submitModal.close();
    try {
      sessionStorage.removeItem(ATTEMPT_KEY);
      sessionStorage.removeItem('phronesis_cbt_admission_number_v1');
    } catch (_) { /* Submission confirmation should not depend on browser storage. */ }
    elements.examView.classList.add('hidden');
    elements.confirmationView.classList.remove('hidden');
    elements.confirmationId.textContent = elements.candidateId.textContent;
    elements.confirmationClass.textContent = activeExam.className;
    elements.confirmationSubject.textContent = activeExam.subject;
    elements.submittedAt.textContent = formatDate(result.submittedAt || result.submitted_at || new Date().toISOString());
    const answeredCount = Object.keys(answers).length;
    const wasAutomaticallySubmitted = automatic || ['auto_submitted', 'expired'].includes(String(result.status || '').toLowerCase());
    elements.confirmationMessage.textContent = wasAutomaticallySubmitted
      ? `The time limit ended and your answers were submitted automatically. ${answeredCount} of ${activeExam.questions.length} questions had a saved answer.`
      : result.message || `Your answers have been recorded. ${answeredCount} of ${activeExam.questions.length} questions had a saved answer.`;
    elements.redirectMessage.textContent = 'Returning to CBT access in 5 seconds…';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => window.location.replace('/cbt'), ACCESS_REDIRECT_DELAY_MS);
  } catch (error) {
    submitting = false;
    elements.submitExamBtn.disabled = false;
    if (!automatic) {
      elements.submitModalMessage.textContent = `${errorMessage(error, 'Submission failed. Check your connection and try again.')}`;
      elements.submitModal.showModal();
    } else {
      setAnswerSaveStatus(errorMessage(error, 'Automatic submission could not reach the server. Retrying…'), 'error');
      window.setTimeout(() => submitAttempt(true), 3000);
    }
  }
}

async function resumeAttempt() {
  let savedAttemptId;
  try {
    savedAttemptId = sessionStorage.getItem(ATTEMPT_KEY);
    admissionNumber = sessionStorage.getItem('phronesis_cbt_admission_number_v1') || '';
  } catch (_) { return; }
  if (!savedAttemptId) return;
  try {
    const response = await cbtStudentAPI.resumeAttempt(savedAttemptId);
    const attempt = response.attempt || response.data?.attempt || response.data || response;
    const examFallback = availableExams.find((exam) => String(exam.exam_id ?? exam.examId ?? exam.id) === String(attempt.exam_id ?? attempt.examId));
    setActiveAttempt(attempt, examFallback || {});
    showExam();
  } catch (error) {
    if (error.status === 401) setAccessMessage('Your temporary CBT session expired. Re-enter your admission number to continue.');
    else if ([404, 409].includes(error.status)) {
      try { sessionStorage.removeItem(ATTEMPT_KEY); } catch (_) { /* Ignore restricted storage. */ }
      setAccessMessage(error.message || 'This attempt is no longer available. Select an available exam to continue.');
    } else setAccessMessage(errorMessage(error, 'Could not resume your exam. Check your connection and try again.'));
  }
}

function setAccessMessage(message) { elements.accessMessage.textContent = message; }
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function errorMessage(error, fallback) {
  if (error.status === 401) return 'Admission number could not be verified. Check it and try again.';
  if (error.status === 403) return error.message || 'This exam is not available for your account.';
  if (error.status === 404) return error.message || 'The exam or attempt could not be found.';
  if (error.status === 409) return error.message || 'This attempt has expired or has already been submitted.';
  if (error.status === 422) return error.message || 'The exam request was not valid.';
  return error.message || fallback;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

