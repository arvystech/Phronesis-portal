import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { classesAPI } from '../api.js';
import { cbtAdminAPI } from '../cbt-api.js';

const PAGE_SIZE = 50;
let page = 1;
let totalPages = 1;
let searchTimer;
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

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
  try {
    const response = await classesAPI.list();
    const payload = response.data;
    const classes = Array.isArray(payload) ? payload : (payload?.classes || payload?.data || []);
    $('classFilter').insertAdjacentHTML('beforeend', classes.map((item) => {
      const id = item.class_id ?? item.id;
      const name = item.class_name ?? item.name ?? item.title;
      return id == null || !name ? '' : `<option value="${esc(id)}">${esc(name)}</option>`;
    }).join(''));
  } catch (_) { /* The roster remains usable without class filter metadata. */ }
  loadStudents();
}

async function loadStudents() {
  $('studentRows').innerHTML = '<tr><td colspan="8" class="cbt-empty">Loading students…</td></tr>';
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
      const name = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
      const latest = student.latest_submission_at ? new Date(student.latest_submission_at).toLocaleString() : '—';
      return `<tr><td data-label="Student"><strong>${esc(name || 'Unnamed student')}</strong></td><td data-label="Admission number">${esc(student.admission_number || '—')}</td><td data-label="Class">${esc(student.class_name || '—')}</td><td data-label="Status"><span class="roster-status">${esc(student.status || '—')}</span></td><td data-label="Attempts">${Number(student.attempt_count || 0)}</td><td data-label="Completed">${Number(student.completed_exam_count || 0)}</td><td data-label="Latest submission">${esc(latest)}</td><td data-label="Action"><a class="cbt-button cbt-button-secondary roster-action" href="/admin/cbt-student-results?studentId=${encodeURIComponent(student.student_id)}">View results</a></td></tr>`;
    }).join('');
  } catch (error) {
    $('studentRows').innerHTML = '<tr><td colspan="8" class="cbt-empty">Could not load students.</td></tr>';
    $('studentError').textContent = error.message || 'Could not load student roster.';
    $('studentError').hidden = false;
  }
}
