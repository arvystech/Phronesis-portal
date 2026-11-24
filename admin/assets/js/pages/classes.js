import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { classesAPI, staffAPI } from '../api.js';

const $ = (id) => document.getElementById(id);
let classRecords = [];
let teachers = [];

document.addEventListener('DOMContentLoaded', () => {
  setupLayout('classes', 'Classes');
  requireAuth(initialize);
});

async function initialize() {
  $('openCreateClass').addEventListener('click', openCreateModal);
  $('closeCreateClass').addEventListener('click', closeCreateModal);
  $('cancelCreateClass').addEventListener('click', closeCreateModal);
  $('refreshClasses').addEventListener('click', loadData);
  $('createClassForm').addEventListener('submit', createClass);
  $('createClassModal').addEventListener('click', (event) => { if (event.target === $('createClassModal')) closeCreateModal(); });
  $('classesRows').addEventListener('click', handleClassAction);
  $('closePasswordModal').addEventListener('click', closePasswordModal);
  $('cancelPasswordUpdate').addEventListener('click', closePasswordModal);
  $('updatePasswordForm').addEventListener('submit', updateClassPassword);
  $('updatePasswordModal').addEventListener('click', (event) => { if (event.target === $('updatePasswordModal')) closePasswordModal(); });
  await loadData();
}

async function loadData() {
  $('classesLoading').hidden = false;
  $('classesError').hidden = true;
  $('classesEmpty').hidden = true;
  try {
    const [classResponse, staffResponse] = await Promise.all([classesAPI.list(), staffAPI.list()]);
    classRecords = extractRecords(classResponse, ['classes', 'data', 'results']);
    teachers = extractRecords(staffResponse, ['staff', 'staffs', 'teachers', 'data', 'results'])
      .filter((record) => String(record.department || '').toLowerCase().includes('teach'));
    if (!teachers.length) teachers = extractRecords(staffResponse, ['staff', 'staffs', 'teachers', 'data', 'results']);
    renderClasses();
    populateTeachers();
  } catch (error) {
    showError(error.message || 'Could not load classes and teachers.');
  } finally {
    $('classesLoading').hidden = true;
  }
}

function extractRecords(response, keys) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 3 && data?.data && !Array.isArray(data); depth += 1) data = data.data;
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function renderClasses() {
  $('classCount').textContent = classRecords.length.toLocaleString();
  const assignedCount = classRecords.filter((record) => getTeacherId(record) != null || record.teacher_name || record.teacherName || record.teacher).length;
  $('assignedCount').textContent = assignedCount.toLocaleString();
  $('classesRows').innerHTML = classRecords.map((record, index) => {
    const className = firstValue(record, ['class_name', 'className', 'name', 'title']) || 'Unnamed class';
    const teacher = resolveTeacher(record);
    const teacherName = teacher ? fullName(teacher) : firstValue(record, ['teacher_name', 'teacherName', 'class_teacher_name', 'classTeacherName']) || 'Not assigned';
    const email = teacher?.email || record.teacher_email || record.teacherEmail || '—';
    const initials = teacherName === 'Not assigned' ? '—' : teacherName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const classId = firstValue(record, ['class_id', 'classId', 'id']);
    return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(className)}</strong></td><td><span class="class-teacher-chip"><span class="class-teacher-avatar">${escapeHtml(initials)}</span><strong>${escapeHtml(teacherName)}</strong></span></td><td class="class-contact">${escapeHtml(email)}</td><td><button class="classes-button classes-button-secondary" type="button" data-class-password="${escapeHtml(classId ?? '')}" data-class-name="${escapeHtml(className)}" ${classId == null ? 'disabled title="Class ID unavailable"' : ''}>Update password</button></td></tr>`;
  }).join('');
  $('classesEmpty').hidden = classRecords.length > 0;
}

function populateTeachers() {
  const select = $('classTeacherSelect');
  select.replaceChildren(new Option(teachers.length ? 'Select a teacher' : 'No teachers found', ''));
  teachers.forEach((teacher) => {
    const id = firstValue(teacher, ['id', 'staff_id', 'staffId', 'staff_no']);
    if (id == null) return;
    const details = [teacher.staff_no || teacher.staffNo, teacher.department].filter(Boolean).join(' · ');
    select.add(new Option(`${fullName(teacher)}${details ? ` — ${details}` : ''}`, String(id)));
  });
  select.disabled = !teachers.length;
}

async function createClass(event) {
  event.preventDefault();
  const form = $('createClassForm');
  if (!form.reportValidity()) return;
  const className = $('classNameInput').value.trim();
  const teacherId = $('classTeacherSelect').value;
  if (!className || !teacherId) return;
  const submit = $('saveClassButton');
  submit.disabled = true;
  submit.textContent = 'Creating…';
  $('createClassError').hidden = true;
  try {
    await classesAPI.create({ class_name: className, teacher_id: Number(teacherId) });
    form.reset();
    closeCreateModal();
    await loadData();
  } catch (error) {
    $('createClassError').textContent = error.message || 'Could not create class. Check the class and teacher details, then try again.';
    $('createClassError').hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Create class';
  }
}

function handleClassAction(event) {
  const button = event.target.closest('[data-class-password]');
  if (!button || !button.dataset.classPassword) return;
  $('passwordClassId').value = button.dataset.classPassword;
  $('passwordClassName').textContent = button.dataset.className || 'Selected class';
  $('passwordInput').value = '';
  $('passwordUpdateError').hidden = true;
  $('passwordUpdateSuccess').hidden = true;
  $('updatePasswordModal').showModal();
  $('passwordInput').focus();
}

async function updateClassPassword(event) {
  event.preventDefault();
  const form = $('updatePasswordForm');
  if (!form.reportValidity()) return;
  const classId = $('passwordClassId').value;
  const password = $('passwordInput').value;
  const submit = $('savePasswordButton');
  submit.disabled = true;
  submit.textContent = 'Updating…';
  $('passwordUpdateError').hidden = true;
  $('passwordUpdateSuccess').hidden = true;
  try {
    await classesAPI.updatePassword(classId, password);
    $('passwordInput').value = '';
    $('passwordUpdateSuccess').textContent = `Password updated for ${$('passwordClassName').textContent}.`;
    $('passwordUpdateSuccess').hidden = false;
  } catch (error) {
    $('passwordUpdateError').textContent = error.message || 'Could not update this class password.';
    $('passwordUpdateError').hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Update password';
  }
}

function openCreateModal() {
  $('createClassError').hidden = true;
  $('createClassModal').showModal();
  $('classNameInput').focus();
}

function closeCreateModal() { $('createClassModal').close(); }
function closePasswordModal() {
  $('passwordInput').value = '';
  $('passwordClassId').value = '';
  $('updatePasswordModal').close();
}
function showError(message) { $('classesError').textContent = message; $('classesError').hidden = false; }
function getTeacherId(record) { return record.teacher_id ?? record.teacherId ?? record.class_teacher_id ?? record.classTeacherId ?? record.teacher?.id ?? record.teacher?.staff_id; }
function resolveTeacher(record) {
  if (record.teacher && typeof record.teacher === 'object') return record.teacher;
  const id = getTeacherId(record);
  return teachers.find((teacher) => String(firstValue(teacher, ['id', 'staff_id', 'staffId', 'staff_no'])) === String(id)) || null;
}
function fullName(record) {
  if (!record) return '';
  return [record.first_name || record.firstName, record.other_names || record.otherNames || record.middle_name || record.middleName, record.last_name || record.lastName].filter(Boolean).join(' ') || record.full_name || record.fullName || record.name || 'Unnamed teacher';
}
function firstValue(record, keys) { for (const key of keys) if (record?.[key] != null && record[key] !== '') return record[key]; return null; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
