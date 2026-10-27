// assets/js/pages/staff-attendance.js
// Staff Attendance Log Page — connected to Live Backend API.
// Staff identity is resolved from the live cache written by staffs.js,
// or fetched directly from the live API when the cache is absent.

import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';

const LIVE_API_ENDPOINT = 'https://api.phronesis-sunesis.com.ng/staff';

let staffId = null;
let currentStaff = null;
let activeStatusFilter = 'All';



const MOCK_ATTENDANCE_LOGS = [
  { date: "Friday, Oct 17, 2026", in: "07:42 AM", out: "04:15 PM", terminal: "Terminal A (Main Gate)", duration: "8h 33m", status: "On Time" },
  { date: "Thursday, Oct 16, 2026", in: "07:51 AM", out: "04:30 PM", terminal: "Terminal A (Main Gate)", duration: "8h 39m", status: "On Time" },
  { date: "Wednesday, Oct 15, 2026", in: "08:12 AM", out: "04:20 PM", terminal: "Terminal B (Admin Block)", duration: "8h 08m", status: "Late" },
  { date: "Tuesday, Oct 14, 2026", in: "07:38 AM", out: "04:10 PM", terminal: "Terminal A (Main Gate)", duration: "8h 32m", status: "On Time" },
  { date: "Monday, Oct 13, 2026", in: "07:45 AM", out: "04:18 PM", terminal: "Terminal A (Main Gate)", duration: "8h 33m", status: "On Time" },
  { date: "Friday, Oct 10, 2026", in: "07:40 AM", out: "04:22 PM", terminal: "Terminal A (Main Gate)", duration: "8h 42m", status: "On Time" },
  { date: "Thursday, Oct 09, 2026", in: "—", out: "—", terminal: "Official Leave (Medical)", duration: "—", status: "Excused" },
  { date: "Wednesday, Oct 08, 2026", in: "07:49 AM", out: "04:15 PM", terminal: "Terminal A (Main Gate)", duration: "8h 26m", status: "On Time" },
  { date: "Tuesday, Oct 07, 2026", in: "07:36 AM", out: "04:10 PM", terminal: "Terminal A (Main Gate)", duration: "8h 34m", status: "On Time" },
  { date: "Monday, Oct 06, 2026", in: "08:05 AM", out: "04:30 PM", terminal: "Terminal B (Admin Block)", duration: "8h 25m", status: "Late" }
];

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('staffs', 'Staff Attendance Log');

  // Extract staff ID from query param ?id=STF001 or clean path /admin/staffs/STF001/attendance
  const params = new URLSearchParams(window.location.search);
  staffId = params.get('id');

  if (!staffId) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    // e.g. /admin/staffs/STF001/attendance -> parts contains ['admin', 'staffs', 'STF001', 'attendance']
    const attIdx = parts.findIndex(p => p.toLowerCase() === 'attendance');
    if (attIdx > 0 && parts[attIdx - 1]) {
      staffId = decodeURIComponent(parts[attIdx - 1]);
    } else {
      const last = parts[parts.length - 1];
      const nonIdNames = ['staffs', 'staff-attendance.html', 'staff-attendance', 'attendance', 'admin'];
      if (last && !nonIdNames.includes(last.toLowerCase())) {
        staffId = decodeURIComponent(last);
      }
    }
  }

  if (!staffId) staffId = 'STF001';

  await requireAuth(() => {
    initAttendancePage();
  });
});

async function initAttendancePage() {
  bindControls();
  await loadStaffAndAttendance();
}

function bindControls() {
  const filterSelect = document.getElementById('attStatusFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      activeStatusFilter = e.target.value;
      renderAttendanceTable();
    });
  }
}

async function loadStaffAndAttendance() {
  const loadingEl = document.getElementById('attendanceLoading');
  const contentEl = document.getElementById('attendanceContent');
  const notFoundEl = document.getElementById('staffNotFound');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (contentEl) contentEl.classList.add('hidden');
  if (notFoundEl) notFoundEl.classList.add('hidden');

  // ── Step 1: Try the live staff cache written by staffs.js ──────────────
  let dataset = null;
  try {
    const liveCache = localStorage.getItem('ps_live_staff_cache');
    if (liveCache) {
      const parsed = JSON.parse(liveCache);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dataset = parsed;
      }
    }
  } catch (e) {}

  // ── Step 2: Cache absent — fetch directly from the live API ────────────
  if (!dataset) {
    try {
      console.info('[Phronesis] Live cache absent; fetching staff list from API...');
      const res = await fetch(LIVE_API_ENDPOINT, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();

      let rawList = null;
      if (Array.isArray(result)) rawList = result;
      else if (Array.isArray(result.staff)) rawList = result.staff;
      else if (Array.isArray(result.data)) rawList = result.data;
      else if (Array.isArray(result.results)) rawList = result.results;

      if (rawList && rawList.length > 0) {
        dataset = rawList.map(raw => ({
          id: raw.id ?? raw.staff_no,
          staffNo: String(raw.staff_no || raw.staffNo || '').trim(),
          firstName: String(raw.first_name || raw.firstName || '').trim(),
          lastName: String(raw.last_name || raw.lastName || '').trim(),
          otherNames: String(raw.other_names || raw.otherNames || '').trim(),
          biometricEnrollmentNo: String(
            raw.biometric_enrollment_no !== undefined ? raw.biometric_enrollment_no
              : (raw.biometricEnrollmentNo !== undefined ? raw.biometricEnrollmentNo : '')
          ).trim(),
          department: (() => {
            const d = String(raw.department || '').trim().toLowerCase();
            return d.includes('non') ? 'Non-teaching' : (d ? 'Teaching' : 'Teaching');
          })(),
          email: raw.email || '',
          role: raw.role || '',
          joinedDate: raw.joinedDate || raw.joined_date || '',
          gender: raw.gender || '',
          phoneNo: raw.phoneNo || raw.phone_no || raw.phone || '',
        })).filter(s => s.staffNo);

        try {
          localStorage.setItem('ps_live_staff_cache', JSON.stringify(dataset));
        } catch (_) {}
      }
    } catch (err) {
      console.error('[Phronesis] Could not load staff from live API:', err.message);
    }
  }

  if (loadingEl) loadingEl.classList.add('hidden');

  // ── Step 3: No data — show error instead of fake records ──────────────
  if (!dataset || dataset.length === 0) {
    if (notFoundEl) {
      notFoundEl.classList.remove('hidden');
      const msgEl = notFoundEl.querySelector('p');
      if (msgEl) {
        msgEl.textContent =
          'Staff data is unavailable — the server could not be reached. ' +
          'Return to the Staffs page to retry loading all records.';
      }
    }
    return;
  }

  // ── Step 4: Find the requested staff record ────────────────────────────
  const match = dataset.find(s =>
    (s.staffNo && s.staffNo.toLowerCase() === staffId.toLowerCase()) ||
    (s.biometricEnrollmentNo && s.biometricEnrollmentNo === staffId)
  );

  if (!match) {
    if (notFoundEl) notFoundEl.classList.remove('hidden');
    return;
  }

  currentStaff = match;
  if (contentEl) contentEl.classList.remove('hidden');

  renderStaffHeader(currentStaff);
  renderAttendanceTable();
}

function renderStaffHeader(staff) {
  const other = staff.otherNames && staff.otherNames.trim() ? ` ${staff.otherNames.trim()}` : '';
  const fullName = `${staff.firstName}${other} ${staff.lastName}`;

  // Avatar initial
  const initials = staff.firstName ? staff.firstName[0].toUpperCase() : 'S';
  const avatarEl = document.getElementById('attAvatar');
  if (avatarEl) avatarEl.textContent = initials;

  // Header info
  setText('attStaffName', fullName);
  setText('attStaffNo', staff.staffNo);
  setText('attBioNo', staff.biometricEnrollmentNo);
  setText('attRole', staff.role || (staff.department === 'Teaching' ? 'Subject Teacher' : 'Non-teaching Staff'));

  // Department Badge: Teaching = GREEN, Non-teaching = BLUE
  const deptBadge = document.getElementById('attDeptBadge');
  const isTeaching = (staff.department || '').toLowerCase() === 'teaching';
  if (deptBadge) {
    deptBadge.textContent = staff.department;
    if (isTeaching) {
      deptBadge.style.backgroundColor = '#DCFCE7';
      deptBadge.style.color = '#166534';
      deptBadge.style.borderColor = '#BBF7D0';
      deptBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border';
    } else {
      deptBadge.style.backgroundColor = '#DBEAFE';
      deptBadge.style.color = '#1D4ED8';
      deptBadge.style.borderColor = '#BFDBFE';
      deptBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border';
    }
  }

  // Update profile links
  const profileUrl = `staff-details.html?id=${encodeURIComponent(staff.staffNo)}`;
  const topProfileBtn = document.getElementById('viewProfileBtn');
  const bottomProfileBtn = document.getElementById('bottomProfileBtn');
  if (topProfileBtn) topProfileBtn.href = profileUrl;
  if (bottomProfileBtn) bottomProfileBtn.href = profileUrl;
}

function renderAttendanceTable() {
  const tbody = document.getElementById('attLogTbody');
  const countEl = document.getElementById('attRecordCount');
  if (!tbody) return;

  tbody.innerHTML = '';

  let records = MOCK_ATTENDANCE_LOGS;
  if (activeStatusFilter !== 'All') {
    records = records.filter(r => r.status.toLowerCase() === activeStatusFilter.toLowerCase());
  }

  if (countEl) {
    countEl.textContent = `Showing ${records.length} of ${MOCK_ATTENDANCE_LOGS.length} demonstration entries`;
  }

  if (records.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="7" class="px-4 py-8 text-center text-text-soft text-xs">
        No attendance records match the selected status filter.
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  records.forEach((rec, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-warm-white/70 transition-colors border-b border-border/60 last:border-b-0';

    // 1. S/N
    const tdSN = document.createElement('td');
    tdSN.className = 'px-4 py-3 text-center text-text-soft font-semibold';
    tdSN.textContent = (idx + 1).toString();
    tr.appendChild(tdSN);

    // 2. Date
    const tdDate = document.createElement('td');
    tdDate.className = 'px-4 py-3 font-medium text-text-dark whitespace-nowrap';
    tdDate.textContent = rec.date;
    tr.appendChild(tdDate);

    // 3. Clock-In
    const tdIn = document.createElement('td');
    tdIn.className = 'px-4 py-3 font-mono text-text-soft whitespace-nowrap';
    tdIn.textContent = rec.in;
    tr.appendChild(tdIn);

    // 4. Clock-Out
    const tdOut = document.createElement('td');
    tdOut.className = 'px-4 py-3 font-mono text-text-soft whitespace-nowrap';
    tdOut.textContent = rec.out;
    tr.appendChild(tdOut);

    // 5. Terminal ID
    const tdTerm = document.createElement('td');
    tdTerm.className = 'px-4 py-3 text-text-soft';
    tdTerm.textContent = rec.terminal;
    tr.appendChild(tdTerm);

    // 6. Duration
    const tdDur = document.createElement('td');
    tdDur.className = 'px-4 py-3 text-text-soft font-mono';
    tdDur.textContent = rec.duration;
    tr.appendChild(tdDur);

    // 7. Status badge
    const tdStatus = document.createElement('td');
    tdStatus.className = 'px-4 py-3 text-right whitespace-nowrap';

    let badgeHtml = '';
    if (rec.status === 'On Time') {
      badgeHtml = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">Present · On Time</span>';
    } else if (rec.status === 'Late') {
      badgeHtml = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Late Arrival</span>';
    } else {
      badgeHtml = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Excused Leave</span>';
    }
    tdStatus.innerHTML = badgeHtml;
    tr.appendChild(tdStatus);

    tbody.appendChild(tr);
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
