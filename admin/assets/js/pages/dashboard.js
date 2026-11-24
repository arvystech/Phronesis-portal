import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { studentsAPI, classesAPI, staffAPI } from '../api.js';
import { cbtAdminAPI } from '../cbt-api.js';

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  setupLayout('dashboard', 'Dashboard');
  requireAuth(loadDashboard);
});

async function loadDashboard() {
  const loading = $('dashboardLoading');
  const content = $('dashboardContent');
  loading.hidden = false;
  try {
    const requests = await Promise.allSettled([
      studentsAPI.list({ page: 1, limit: 5 }),
      classesAPI.list(),
      staffAPI.list(),
      cbtAdminAPI.listExams(),
    ]);
    const labels = ['students', 'classes', 'staff', 'CBT exams'];
    const failed = requests.map((result, index) => result.status === 'rejected' ? labels[index] : null).filter(Boolean);
    const studentsResponse = requests[0].status === 'fulfilled' ? requests[0].value : null;
    const classesResponse = requests[1].status === 'fulfilled' ? requests[1].value : null;
    const staffResponse = requests[2].status === 'fulfilled' ? requests[2].value : null;
    const examsResponse = requests[3].status === 'fulfilled' ? requests[3].value : null;

    const recentStudents = extractArray(studentsResponse, ['students', 'data', 'results', 'items']);
    const classes = extractArray(classesResponse, ['classes', 'data', 'results', 'items']);
    const staff = extractArray(staffResponse, ['staff', 'staffs', 'teachers', 'data', 'results', 'items']);
    const exams = extractArray(examsResponse, ['exams', 'data', 'results', 'items']);

    setResourceCount('statStudents', studentsResponse, recentStudents);
    setResourceCount('statClasses', classesResponse, classes);
    setResourceCount('statStaff', staffResponse, staff);
    setResourceCount('statCbtExams', examsResponse, exams);

    const published = exams.filter((exam) => ['published', 'open', 'active'].includes(String(first(exam, 'status', 'state')).toLowerCase())).length;
    const drafts = exams.filter((exam) => String(first(exam, 'status', 'state')).toLowerCase() === 'draft').length;
    $('publishedExamCount').textContent = examsResponse ? published.toLocaleString() : '—';
    $('draftExamCount').textContent = examsResponse ? drafts.toLocaleString() : '—';
    renderRecentStudents(recentStudents);

    if (failed.length) {
      $('dashboardError').textContent = `Some dashboard data could not be loaded: ${failed.join(', ')}. The available sections are still shown.`;
      $('dashboardError').hidden = false;
    }
    content.hidden = false;
  } catch (error) {
    $('dashboardError').textContent = error.message || 'Could not load dashboard data. Please refresh to try again.';
    $('dashboardError').hidden = false;
    content.hidden = false;
  } finally {
    loading.hidden = true;
  }
}

function extractArray(response, keys) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data && !Array.isArray(data); depth += 1) {
    const key = keys.find((candidate) => Array.isArray(data[candidate]));
    if (key) return data[key];
    if (data.data && typeof data.data === 'object') data = data.data;
    else break;
  }
  return Array.isArray(data) ? data : [];
}

function getTotal(response, records) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data && typeof data === 'object'; depth += 1) {
    const pagination = data.pagination || data.meta;
    const total = pagination?.total ?? pagination?.totalRecords ?? pagination?.total_records ?? data.total;
    if (total !== undefined && total !== null && Number.isFinite(Number(total))) return Number(total);
    if (data.data && typeof data.data === 'object') data = data.data;
    else break;
  }
  return records.length;
}

function first(record, ...keys) {
  for (const key of keys) if (record?.[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  return '';
}

function setResourceCount(id, response, records) {
  $(id).textContent = response == null ? '—' : Number(getTotal(response, records)).toLocaleString();
}

function renderRecentStudents(students) {
  if (!students.length) {
    $('recentStudentsRows').innerHTML = '<tr><td colspan="5" class="dashboard-table-empty">No student records are available.</td></tr>';
    return;
  }
  $('recentStudentsRows').innerHTML = students.slice(0, 5).map((student) => {
    const id = first(student, 'student_id', 'studentId', 'id');
    const name = first(student, 'full_name', 'fullName', 'student_name', 'studentName') || [first(student, 'first_name', 'firstName'), first(student, 'middle_name', 'middleName'), first(student, 'last_name', 'lastName')].filter(Boolean).join(' ') || 'Unnamed student';
    const admission = first(student, 'admission_number', 'admissionNumber', 'registration_number', 'registrationNumber') || '—';
    const classValue = first(student, 'class_name', 'className', 'class');
    const className = typeof classValue === 'object' ? first(classValue, 'class_name', 'className', 'name') || '—' : classValue || '—';
    const status = first(student, 'status', 'admissionStatus', 'admission_status') || 'Active';
    const active = ['active', 'approved', 'admitted'].includes(String(status).toLowerCase());
    const details = id === '' ? '#' : `/admin/students/${encodeURIComponent(id)}`;
    const results = id === '' ? '#' : `/admin/student-results?studentId=${encodeURIComponent(id)}`;
    return `<tr><td><strong>${escapeHtml(name)}</strong></td><td>${escapeHtml(admission)}</td><td>${escapeHtml(className)}</td><td><span class="dashboard-status${active ? '' : ' is-muted'}">${escapeHtml(status)}</span></td><td><a href="${details}" aria-label="View ${escapeHtml(name)} details" title="View student">View</a><span class="dashboard-row-separator">·</span><a href="${results}" aria-label="View ${escapeHtml(name)} uploaded results" title="Uploaded exam results">Results</a></td></tr>`;
  }).join('');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
