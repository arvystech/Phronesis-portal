import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { studentsAPI } from '../api.js';

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  setupLayout('students', 'Uploaded exam results');
  requireAuth(loadStudentResults);
});

async function loadStudentResults() {
  const studentId = new URLSearchParams(window.location.search).get('studentId') || '';
  if (!studentId) return showError('No student was selected. Return to the Students page and try again.');
  try {
    const [studentResponse, resultsResponse] = await Promise.all([
      studentsAPI.get(studentId),
      studentsAPI.getResults(studentId),
    ]);
    const student = extractStudent(studentResponse);
    if (!student) throw new Error('Student record not found.');
    const results = extractResults(resultsResponse);
    renderStudent(student);
    renderResults(results);
  } catch (error) {
    showError(error.message || 'Could not load this student’s uploaded exam results.');
  } finally {
    $('uploadedResultsLoading').hidden = true;
  }
}

function extractStudent(response) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data && typeof data === 'object'; depth += 1) {
    if (data.student && typeof data.student === 'object') return data.student;
    if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) { data = data.data; continue; }
    if (data.student_id != null || data.studentId != null || data.id != null) return data;
    break;
  }
  return null;
}

function extractResults(response) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data && !Array.isArray(data); depth += 1) {
    for (const key of ['results', 'grades', 'items']) if (Array.isArray(data[key])) return data[key];
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === 'object') data = data.data;
    else break;
  }
  return Array.isArray(data) ? data : [];
}

function renderStudent(student) {
  const classValue = student.class_name || student.className || student.class || '—';
  $('uploadedStudentName').textContent = student.fullName || student.full_name || student.student_name || [student.firstName || student.first_name, student.middleName || student.middle_name, student.lastName || student.last_name].filter(Boolean).join(' ') || 'Unnamed student';
  $('uploadedStudentAdmission').textContent = student.admissionNumber || student.admission_number || student.registrationNumber || student.registration_number || '—';
  $('uploadedStudentClass').textContent = typeof classValue === 'object' ? classValue.class_name || classValue.className || classValue.name || '—' : classValue;
  $('uploadedStudentSummary').hidden = false;
}

function renderResults(results) {
  $('uploadedResultsCount').textContent = `${results.length} record${results.length === 1 ? '' : 's'}`;
  $('uploadedResultsRows').innerHTML = results.map((result, index) => {
    const subjectValue = result.subject_name || result.subjectName || result.subject || result.subject_name || '—';
    const subject = typeof subjectValue === 'object' ? subjectValue.subject_name || subjectValue.subjectName || subjectValue.name || '—' : subjectValue;
    const ca = result.totalCA ?? result.total_ca ?? result.ca_score ?? result.caScore ?? componentTotal(result);
    const exam = result.examination ?? result.exam_score ?? result.examScore ?? result.exam ?? '—';
    const total = result.finalTotal ?? result.final_total ?? result.total_score ?? result.totalScore ?? result.total ?? '—';
    const grade = result.grade || '—';
    const period = [
      periodLabel(result.term_name || result.termName || result.term_id || result.termId || result.term),
      periodLabel(result.session_name || result.sessionName || result.session_id || result.sessionId || result.session),
    ].filter(Boolean).join(' / ') || '—';
    return `<tr><td data-label="S/N">${index + 1}</td><td data-label="Subject"><strong>${escapeHtml(subject)}</strong></td><td data-label="CA / 30">${escapeHtml(ca)}</td><td data-label="Examination / 70">${escapeHtml(exam)}</td><td data-label="Total / 100"><strong>${escapeHtml(total)}</strong></td><td data-label="Grade"><span class="uploaded-grade">${escapeHtml(grade)}</span></td><td data-label="Term / Session">${escapeHtml(period)}</td></tr>`;
  }).join('');
  $('uploadedResultsPanel').hidden = false;
  $('uploadedResultsEmpty').hidden = results.length > 0;
}

function componentTotal(result) {
  const parts = [result.ca1, result.ca2, result.ca3].map(Number);
  return parts.every(Number.isFinite) ? parts.reduce((sum, score) => sum + score, 0) : '—';
}

function periodLabel(value) {
  if (value && typeof value === 'object') return value.name || value.term_name || value.termName || value.session_name || value.sessionName || value.title || value.id || '';
  return value == null ? '' : String(value);
}

function showError(message) {
  $('uploadedResultsError').textContent = message;
  $('uploadedResultsError').hidden = false;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
