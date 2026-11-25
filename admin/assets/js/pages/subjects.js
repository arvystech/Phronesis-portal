import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { cbtAdminAPI } from '../cbt-api.js';

const $ = (id) => document.getElementById(id);
let classes = [];
let subjects = [];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

document.addEventListener('DOMContentLoaded', () => {
  setupLayout('subjects', 'Subjects');
  requireAuth(initialize);
});

function initialize() {
  $('openSubjectModal').addEventListener('click', () => openSubjectModal());
  $('closeSubjectModal').addEventListener('click', closeSubjectModal);
  $('cancelSubjectModal').addEventListener('click', closeSubjectModal);
  $('refreshSubjects').addEventListener('click', loadData);
  $('subjectForm').addEventListener('submit', saveSubject);
  $('subjectsRows').addEventListener('click', handleSubjectAction);
  $('subjectModal').addEventListener('click', (event) => { if (event.target === $('subjectModal')) closeSubjectModal(); });
  loadData();
}

async function loadData() {
  $('subjectsLoading').hidden = false;
  $('subjectsError').hidden = true;
  $('subjectsEmpty').hidden = true;
  try {
    const [classResponse, subjectResponse] = await Promise.all([
      cbtAdminAPI.listAdminClasses(),
      cbtAdminAPI.listSubjects(),
    ]);
    classes = extractList(classResponse, ['classes', 'items']);
    subjects = extractList(subjectResponse, ['subjects', 'items']);
    renderSubjects();
    renderClassOptions();
  } catch (error) {
    $('subjectsError').textContent = error.message || 'Could not load subjects and classes.';
    $('subjectsError').hidden = false;
  } finally {
    $('subjectsLoading').hidden = true;
  }
}

function extractList(payload, keys) {
  let data = payload;
  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    for (const key of keys) if (Array.isArray(data[key])) return data[key];
    data = data.data;
  }
  return [];
}

function classId(record) { return record.class_id ?? record.classId ?? record.id; }
function className(record) { return record.class_name ?? record.className ?? record.name ?? record.title ?? ''; }
function subjectId(record) { return record.subject_id ?? record.subjectId ?? record.id; }
function subjectName(record) { return record.subject_name ?? record.subjectName ?? record.name ?? record.title ?? 'Unnamed subject'; }

function assignedClassIds(subject) {
  const ids = subject.class_ids ?? subject.classIds ?? subject.classes?.map((item) => classId(item));
  return Array.isArray(ids) ? ids.map(String) : [];
}

function assignedClassNames(subject) {
  const directNames = subject.class_names ?? subject.classNames;
  if (Array.isArray(directNames) && directNames.length) return directNames;
  if (Array.isArray(subject.classes) && subject.classes.length) return subject.classes.map(className).filter(Boolean);
  const ids = assignedClassIds(subject);
  return ids.map((id) => className(classes.find((item) => String(classId(item)) === id) || {})).filter(Boolean);
}

function renderSubjects() {
  $('subjectCount').textContent = subjects.length.toLocaleString();
  const offeringCount = subjects.reduce((sum, subject) => sum + assignedClassIds(subject).length, 0);
  $('classOfferingCount').textContent = offeringCount.toLocaleString();
  $('subjectsRows').innerHTML = subjects.map((subject, index) => {
    const names = assignedClassNames(subject);
    const id = subjectId(subject);
    return `<tr><td>${index + 1}</td><td><strong>${esc(subjectName(subject))}</strong></td><td>${esc(subject.subject_code ?? subject.subjectCode ?? '—')}</td><td>${names.length ? names.map((name) => `<span class="subject-class-chip">${esc(name)}</span>`).join(' ') : '<span class="subject-unassigned">No classes assigned</span>'}</td><td><button class="subjects-button subjects-button-secondary" type="button" data-edit-subject="${esc(id ?? '')}" ${id == null ? 'disabled title="Subject ID unavailable"' : ''}>Edit classes</button></td></tr>`;
  }).join('');
  $('subjectsEmpty').hidden = subjects.length > 0;
}

function renderClassOptions(selectedIds = []) {
  const selected = new Set(selectedIds.map(String));
  const container = $('subjectClasses');
  if (!classes.length) {
    container.innerHTML = '<span>No classes found. Create classes before assigning subject offerings.</span>';
    return;
  }
  container.innerHTML = classes.map((record) => {
    const id = classId(record);
    const name = className(record);
    if (id == null || !name) return '';
    return `<label class="subject-class-option"><input type="checkbox" name="classIds" value="${esc(id)}" ${selected.has(String(id)) ? 'checked' : ''}><span>${esc(name)}</span></label>`;
  }).join('');
}

function openSubjectModal(subject = null) {
  $('subjectForm').reset();
  $('subjectFormError').hidden = true;
  $('subjectId').value = subject ? String(subjectId(subject) ?? '') : '';
  const editing = Boolean(subject);
  $('subjectModalTitle').textContent = editing ? `Edit ${subjectName(subject)} class offerings` : 'Add a subject';
  $('subjectModalEyebrow').textContent = editing ? 'UPDATE OFFERINGS' : 'NEW SUBJECT';
  $('subjectModalDescription').textContent = editing
    ? 'Update which classes offer this subject.'
    : 'Enter subject details and choose the classes that offer it.';
  $('subjectDetailsFields').hidden = editing;
  $('subjectName').required = !editing;
  $('saveSubject').textContent = editing ? 'Save class offerings' : 'Create subject';
  renderClassOptions(editing ? assignedClassIds(subject) : []);
  $('subjectModal').showModal();
}

function closeSubjectModal() {
  if ($('subjectModal').open) $('subjectModal').close();
}

function handleSubjectAction(event) {
  const button = event.target.closest('[data-edit-subject]');
  if (!button) return;
  const subject = subjects.find((item) => String(subjectId(item)) === button.dataset.editSubject);
  if (subject) openSubjectModal(subject);
}

async function saveSubject(event) {
  event.preventDefault();
  const editingId = $('subjectId').value;
  const classIds = [...document.querySelectorAll('#subjectClasses input[name="classIds"]:checked')]
    .map((input) => Number(input.value));
  if (!classIds.length) {
    $('subjectFormError').textContent = 'Select at least one class offering.';
    $('subjectFormError').hidden = false;
    return;
  }
  const button = $('saveSubject');
  button.disabled = true;
  button.textContent = editingId ? 'Saving...' : 'Creating...';
  $('subjectFormError').hidden = true;
  try {
    if (editingId) {
      await cbtAdminAPI.updateSubjectClasses(editingId, classIds);
    } else {
      const subjectNameValue = $('subjectName').value.trim();
      const subjectCode = $('subjectCode').value.trim();
      const syllabus = $('subjectSyllabus').value.trim();
      await cbtAdminAPI.createSubject({
        subjectName: subjectNameValue,
        subjectCode,
        syllabus,
        classIds,
      });
    }
    closeSubjectModal();
    await loadData();
  } catch (error) {
    $('subjectFormError').textContent = error.message || 'Could not save the subject.';
    $('subjectFormError').hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = editingId ? 'Save class offerings' : 'Create subject';
  }
}
