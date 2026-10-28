// admin/js/pages/registrations.js
import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { studentsAPI } from '../api.js';
import { formatCurrency, statusColor, groupStudentsByDate } from '../helpers.js';

let allStudents = [];
let filters = { search: '', status: '', class: '' };

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('students', 'Registrations');

  await requireAuth(() => {
    initRegistrations();
  });
});

async function initRegistrations() {
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const classFilter = document.getElementById('classFilter');

  searchInput.addEventListener('input', (e) => {
    filters.search = e.target.value.trim().toLowerCase();
    renderFiltered();
  });

  statusFilter.addEventListener('change', (e) => {
    filters.status = e.target.value;
    renderFiltered();
  });

  classFilter.addEventListener('change', (e) => {
    filters.class = e.target.value;
    renderFiltered();
  });

  await fetchStudents();
}

async function fetchStudents() {
  const loadingEl = document.getElementById('studentsLoading');
  const listEl = document.getElementById('studentsList');

  try {
    loadingEl.classList.remove('hidden');
    listEl.classList.add('hidden');

    const res = await studentsAPI.list({ sort: 'registrationDate', order: 'DESC' });
    allStudents = res.data?.data || [];
    renderFiltered();
  } catch (err) {
    console.error('Failed to load students:', err);
    window.toast.error('Failed to load students');
  } finally {
    loadingEl.classList.add('hidden');
    listEl.classList.remove('hidden');
  }
}

function renderFiltered() {
  const filtered = allStudents.filter((s) => {
    const fullName = (s.fullName || '').toLowerCase();
    const regNum = (s.registrationNumber || '').toLowerCase();
    const matchSearch = !filters.search || fullName.includes(filters.search) || regNum.includes(filters.search);
    const matchStatus = !filters.status || s.admissionStatus === filters.status;
    const matchClass = !filters.class || s.class === filters.class;
    return matchSearch && matchStatus && matchClass;
  });

  // Update record count
  const countEl = document.getElementById('recordCount');
  if (countEl) countEl.textContent = `${filtered.length} records · Session 2025/2026`;

  const listEl = document.getElementById('studentsList');
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-20 bg-white rounded-2xl border border-dashed border-border">
        <p class="text-text-soft">No registration records found.</p>
      </div>
    `;
    return;
  }

  const grouped = groupStudentsByDate(filtered);

  listEl.innerHTML = grouped.map((group) => {
    const cards = group.students.map((student) => {
      const balance = parseFloat(student.balance || 0);
      const regTime = student.registrationTime ||
        (student.registrationDate ? new Date(student.registrationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

      const passportSrc = student.studentPassport || '/admin/assets/images/avatars/default_student.png';

      return `
        <div
          onclick="window.location.href='/admin/students/${encodeURIComponent(student.id)}'"
          class="group bg-white p-4 rounded-2xl border border-gold/30 hover:border-royal/40 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="flex items-center gap-4 sm:gap-5">
            <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-warm-white border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="${passportSrc}"
                onerror="this.src='/admin/assets/images/avatars/default_student.png'"
                alt="${student.fullName}"
                class="w-full h-full object-cover"
              />
            </div>
            <div>
              <h4 class="text-base sm:text-lg font-bold text-royal-deep group-hover:text-royal transition-colors">
                ${student.fullName}
              </h4>
              <div class="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-[11px] sm:text-xs text-text-soft">
                <span class="font-medium px-2 py-0.5 bg-warm-white rounded-md border border-border">
                  ${student.class}
                </span>
                <span class="hidden sm:inline">•</span>
                <span>${student.gender || '—'}</span>
                <span class="hidden sm:inline">•</span>
                <span class="flex items-center gap-1 font-mono">
                  🕒 ${regTime}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-border/50">
            <span class="${statusColor(student.admissionStatus)}">${student.admissionStatus}</span>
            <span class="text-xs font-bold ${balance > 0 ? 'text-red-500' : 'text-emerald-600'}">
              ${balance > 0 ? `Owes: ${formatCurrency(balance)}` : 'Fully Paid'}
            </span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-3">
        <h3 class="text-xs font-bold text-royal-deep tracking-widest pl-2 uppercase">
          ${group.label}
        </h3>
        <div class="grid grid-cols-1 gap-3">
          ${cards}
        </div>
      </div>
    `;
  }).join('');
}
