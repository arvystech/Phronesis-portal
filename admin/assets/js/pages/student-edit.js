import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { studentsAPI, classesAPI } from '../api.js';

const $ = (id) => document.getElementById(id);
let studentId = '';
let studentRecord;
let classRecords = [];

document.addEventListener('DOMContentLoaded', () => {
  setupLayout('students', 'Edit student');
  requireAuth(initialize);
});

async function initialize() {
  studentId = new URLSearchParams(window.location.search).get('id') || new URLSearchParams(window.location.search).get('studentId') || '';
  if (!studentId) return showLoadError('No student ID was provided. Return to the Students page and choose a student.');
  $('studentEditForm').addEventListener('submit', saveStudent);
  try {
    const [studentResponse, classResponse] = await Promise.all([studentsAPI.get(studentId), classesAPI.list()]);
    studentRecord = extractStudent(studentResponse);
    classRecords = extractRecords(classResponse, ['classes', 'data', 'results']);
    if (!studentRecord) throw new Error('Student not found.');
    populateClasses();
    populateForm(studentRecord);
    $('studentEditLoading').hidden = true;
    $('studentEditForm').hidden = false;
  } catch (error) {
    showLoadError(error.message || 'Could not load this student’s details.');
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

function extractRecords(response, keys) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data && !Array.isArray(data); depth += 1) {
    const key = keys.find((name) => Array.isArray(data[name]));
    if (key) return data[key];
    if (data.data && typeof data.data === 'object') data = data.data;
    else break;
  }
  return Array.isArray(data) ? data : [];
}

function first(record, ...keys) {
  for (const key of keys) if (record?.[key] !== undefined && record[key] !== null) return record[key];
  return '';
}

function populateClasses() {
  const select = $('editClass');
  select.replaceChildren(new Option(classRecords.length ? 'Select class' : 'No classes available', ''));
  classRecords.forEach((item) => {
    const id = first(item, 'class_id', 'classId', 'id');
    const name = first(item, 'class_name', 'className', 'name');
    if (id !== '' && name) select.add(new Option(name, String(id)));
  });
}

function populateForm(record) {
  const firstName = first(record, 'first_name', 'firstName');
  const middleName = first(record, 'middle_name', 'middleName', 'other_names', 'otherNames');
  const lastName = first(record, 'last_name', 'lastName');
  const fullName = first(record, 'full_name', 'fullName', 'student_name', 'studentName');
  const nameParts = fullName ? String(fullName).trim().split(/\s+/) : [];
  $('editAdmissionNumber').value = first(record, 'admission_number', 'admissionNumber', 'registration_number', 'registrationNumber');
  $('editFirstName').value = firstName || nameParts[0] || '';
  $('editMiddleName').value = middleName || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '');
  $('editLastName').value = lastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
  setOptionalSelect('editGender', first(record, 'gender'));
  const dob = first(record, 'date_of_birth', 'dateOfBirth', 'dob');
  $('editDateOfBirth').value = dob ? String(dob).slice(0, 10) : '';
  $('editGuardianName').value = first(record, 'guardian_name', 'guardianName') || '';
  $('editGuardianPhone').value = first(record, 'guardian_phone', 'guardianPhone') || '';
  const recordClassId = first(record, 'class_id', 'classId') || first(record.class, 'class_id', 'classId', 'id');
  const recordClassName = typeof record.class === 'string' ? record.class : first(record, 'class_name', 'className') || first(record.class, 'class_name', 'className', 'name');
  const matchingClass = classRecords.find((item) => String(first(item, 'class_id', 'classId', 'id')) === String(recordClassId)) ||
    classRecords.find((item) => String(first(item, 'class_name', 'className', 'name')).toLowerCase() === String(recordClassName).toLowerCase());
  if (matchingClass) {
    $('editClass').value = String(first(matchingClass, 'class_id', 'classId', 'id'));
  }
}

function setOptionalSelect(id, value) {
  const select = $(id);
  if (!value) { select.value = ''; return; }
  const matching = [...select.options].find((option) => option.value.toLowerCase() === String(value).toLowerCase());
  if (matching) select.value = matching.value;
  else {
    select.add(new Option(String(value), String(value)));
    select.value = String(value);
  }
}

async function saveStudent(event) {
  event.preventDefault();
  if (!$('studentEditForm').reportValidity()) return;
  const button = $('saveStudentEdit');
  button.disabled = true;
  showFormMessage('Saving student details...', false);
  try {
    const details = {
      admissionNumber: $('editAdmissionNumber').value.trim(),
      firstName: $('editFirstName').value.trim(),
      middleName: $('editMiddleName').value.trim(),
      lastName: $('editLastName').value.trim(),
      gender: $('editGender').value,
      dateOfBirth: $('editDateOfBirth').value,
      guardianName: $('editGuardianName').value.trim(),
      guardianPhone: $('editGuardianPhone').value.trim(),
      classId: Number.isFinite(Number($('editClass').value)) ? Number($('editClass').value) : $('editClass').value,
    };
    await studentsAPI.updateDetails(studentId, details);
    showFormMessage('Student details updated. Returning to the Students page...', false);
    window.setTimeout(() => { window.location.href = '/admin/students'; }, 800);
  } catch (error) {
    showFormMessage(error.message || 'Could not save student details.', true);
  } finally {
    button.disabled = false;
  }
}

function showLoadError(message) {
  $('studentEditLoading').hidden = true;
  $('studentEditError').textContent = message;
  $('studentEditError').hidden = false;
}

function showFormMessage(message, isError) {
  const el = $('studentEditMessage');
  el.textContent = message;
  el.classList.toggle('is-error', isError);
  el.classList.toggle('is-success', !isError);
  el.hidden = false;
}
