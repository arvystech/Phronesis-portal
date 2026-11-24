import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { studentsAPI, classesAPI } from '../api.js';

const $ = (id) => document.getElementById(id);
let students = [];
let classes = [];
let page = 1;
let total = 0;
let totalPages = 1;
let searchTimer;

document.addEventListener('DOMContentLoaded', () => {
  setupLayout('students', 'Students');
  requireAuth(initialize);
});

async function initialize() {
  $('studentSearch').addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { page = 1; loadStudents(); }, 300);
  });
  $('studentClassFilter').addEventListener('change', () => { page = 1; loadStudents(); });
  $('studentStatusFilter').addEventListener('change', () => { page = 1; loadStudents(); });
  $('previousStudentPage').addEventListener('click', () => { if (page > 1) { page -= 1; loadStudents(); } });
  $('nextStudentPage').addEventListener('click', () => { if (page < totalPages) { page += 1; loadStudents(); } });
  $('studentRows').addEventListener('click', handleRowAction);
  $('changeClassForm').addEventListener('submit', saveClassChange);
  $('closeChangeClass').addEventListener('click', closeClassModal);
  $('cancelChangeClass').addEventListener('click', closeClassModal);
  $('changeClassModal').addEventListener('click', (event) => {
    if (event.target === $('changeClassModal')) closeClassModal();
  });
  await loadDirectory();
}

async function loadDirectory() {
  try {
    const classResponse = await classesAPI.list().catch(() => null);
    classes = classResponse ? extractRecords(classResponse, ['classes', 'data', 'results']) : [];
    populateClassFilters();
    await loadStudents();
  } catch (error) {
    showDirectoryError(error);
  }
}

async function loadStudents() {
  $('studentLoading').hidden = false;
  $('studentError').hidden = true;
  $('studentRows').replaceChildren();
  try {
    const params = {
      page,
      limit: 50,
      search: $('studentSearch').value.trim(),
      classId: $('studentClassFilter').value,
      status: $('studentStatusFilter').value,
    };
    const studentResponse = await studentsAPI.list(params);
    students = extractRecords(studentResponse, ['students', 'data', 'results']);
    const pagination = extractPagination(studentResponse);
    total = Number(pagination.total ?? students.length);
    totalPages = Math.max(1, Number(pagination.totalPages ?? Math.ceil(total / (Number(pagination.limit) || params.limit))));
    page = Math.min(page, totalPages);
    renderStudents();
  } catch (error) {
    showDirectoryError(error);
  } finally {
    $('studentLoading').hidden = true;
  }
}

function showDirectoryError(error) {
  $('studentError').textContent = error.message || 'Could not load students. Please try again.';
  $('studentError').hidden = false;
}

function extractPagination(response) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data && !Array.isArray(data); depth += 1) {
    if (data.pagination && typeof data.pagination === 'object') return data.pagination;
    data = data.data && typeof data.data === 'object' ? data.data : null;
  }
  return {};
}

function extractRecords(response, keys) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data && !Array.isArray(data); depth += 1) {
    const found = keys.find((key) => Array.isArray(data[key]));
    if (found) return data[found];
    if (data.data && typeof data.data === 'object') data = data.data;
    else break;
  }
  return Array.isArray(data) ? data : [];
}

function first(record, keys) {
  for (const key of keys) if (record?.[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  return '';
}

function studentId(student) { return first(student, ['student_id', 'studentId', 'id']); }
function studentName(student) {
  return first(student, ['fullName', 'full_name', 'student_name', 'studentName']) ||
    [first(student, ['first_name', 'firstName']), first(student, ['middle_name', 'middleName']), first(student, ['last_name', 'lastName'])].filter(Boolean).join(' ') || 'Unnamed student';
}
function admissionNumber(student) { return first(student, ['admission_number', 'admissionNumber', 'registrationNumber', 'registration_number', 'student_no']) || '—'; }
function classId(student) { return first(student, ['class_id', 'classId']); }
function className(student) {
  const name = first(student, ['class_name', 'className', 'class']);
  if (name && typeof name === 'object') return first(name, ['class_name', 'className', 'name']) || '—';
  return name || classes.find((item) => String(first(item, ['class_id', 'classId', 'id'])) === String(classId(student)))?.class_name || '—';
}

function populateClassFilters() {
  const filters = $('studentClassFilter');
  const selected = filters.value;
  filters.replaceChildren(new Option('All classes', ''));
  classes.forEach((item) => {
    const id = first(item, ['class_id', 'classId', 'id']);
    const name = first(item, ['class_name', 'className', 'name']);
    if (id !== '' && name) filters.add(new Option(name, String(id)));
  });
  if ([...filters.options].some((option) => option.value === selected)) filters.value = selected;

  const target = $('targetClass');
  target.replaceChildren(new Option(classes.length ? 'Select a class' : 'No classes available', ''));
  classes.forEach((item) => {
    const name = first(item, ['class_name', 'className', 'name']);
    const id = first(item, ['class_id', 'classId', 'id']);
    if (name && id !== '') target.add(new Option(name, String(id)));
  });
}

function renderStudents() {
  $('studentCount').textContent = `${total.toLocaleString()} student${total === 1 ? '' : 's'}`;
  $('studentRows').innerHTML = students.map((student, index) => renderRow(student, ((page - 1) * 50) + index)).join('');
  $('studentEmpty').hidden = students.length > 0;
  $('studentPagination').hidden = totalPages <= 1;
  $('studentPageInfo').textContent = total ? `Page ${page} of ${totalPages} · ${((page - 1) * 50) + 1}-${Math.min(page * 50, total)} of ${total}` : 'No records';
  $('previousStudentPage').disabled = page <= 1;
  $('nextStudentPage').disabled = page >= totalPages;
}

function renderRow(student, index) {
  const id = studentId(student);
  const idValue = escapeHtml(id);
  const name = studentName(student);
  const status = first(student, ['status', 'admissionStatus', 'admission_status']) || 'Active';
  const detailsHref = id === '' ? '#' : `/admin/student-edit?id=${encodeURIComponent(id)}`;
  const resultsHref = id === '' ? '#' : `/admin/student-results?studentId=${encodeURIComponent(id)}`;
  return `<tr>
    <td data-label="S/N">${index + 1}</td>
    <td data-label="Admission number"><strong>${escapeHtml(admissionNumber(student))}</strong></td>
    <td data-label="Student name">${escapeHtml(name)}</td>
    <td data-label="Class">${escapeHtml(className(student))}</td>
    <td data-label="Status"><span class="student-status-badge">${escapeHtml(status)}</span></td>
    <td class="student-row-action-cell"><div class="student-row-actions">
      <a class="student-icon-action" href="${detailsHref}" title="Edit student details" aria-label="Edit details for ${escapeHtml(name)}" ${id === '' ? 'aria-disabled="true" tabindex="-1"' : ''}>${icon('edit')}</a>
      <button class="student-icon-action" type="button" data-action="change-class" data-student-id="${idValue}" data-student-name="${escapeHtml(name)}" title="Change class" aria-label="Change class for ${escapeHtml(name)}" ${id === '' ? 'disabled' : ''}>${icon('class')}</button>
      <a class="student-icon-action" href="${resultsHref}" title="View exam results" aria-label="View exam results for ${escapeHtml(name)}" ${id === '' ? 'aria-disabled="true" tabindex="-1"' : ''}>${icon('results')}</a>
    </div></td>
  </tr>`;
}

function handleRowAction(event) {
  const button = event.target.closest('[data-action="change-class"]');
  if (!button) return;
  $('changeClassStudentId').value = button.dataset.studentId;
  $('changeClassStudent').textContent = `${button.dataset.studentName} · currently in ${students.find((s) => String(studentId(s)) === button.dataset.studentId) ? className(students.find((s) => String(studentId(s)) === button.dataset.studentId)) : '—'}`;
  $('targetClass').value = '';
  $('changeClassError').hidden = true;
  $('changeClassModal').showModal();
}

function closeClassModal() { $('changeClassModal').close(); }

async function saveClassChange(event) {
  event.preventDefault();
  if (!$('changeClassForm').reportValidity()) return;
  const button = $('saveClassChange');
  button.disabled = true;
  $('changeClassError').hidden = true;
  const id = $('changeClassStudentId').value;
  try {
    await studentsAPI.changeClass(id, $('targetClass').value);
    closeClassModal();
    await loadStudents();
  } catch (error) {
    $('changeClassError').textContent = error.message || 'Could not change this student’s class.';
    $('changeClassError').hidden = false;
  } finally {
    button.disabled = false;
  }
}

function icon(type) {
  const paths = {
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    class: '<path d="M3 5h18v14H3z"/><path d="M7 9h10M7 13h6"/><path d="m16 16 2 2 4-4"/>',
    results: '<path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/><path d="M16 7h3v3"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type]}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
