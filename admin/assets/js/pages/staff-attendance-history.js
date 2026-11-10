// admin/assets/js/pages/staff-attendance-history.js
// Individual Staff Attendance History & Punctuality Audit

import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { staffAPI, staffAttendanceAPI } from '../api.js';

const PAGE_SIZE = 15;
let staffId = null;
let staffMember = null;
let allRecords = [];
let filteredRecords = [];
let currentPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('staffs', 'Staff Attendance History');

  // Extract numeric staff ID from URL path: /admin/staffs/17/attendance
  const path = window.location.pathname;
  const match = path.match(/\/admin\/staffs\/(\d+)\/attendance/);
  if (match) {
    staffId = parseInt(match[1], 10);
  }

  // Fallback: check parts
  if (!staffId) {
    const parts = path.split('/').filter(Boolean);
    const attIdx = parts.indexOf('attendance');
    if (attIdx > 0 && /^\d+$/.test(parts[attIdx - 1])) {
      staffId = parseInt(parts[attIdx - 1], 10);
    }
  }

  // Fallback: query param ?id=17
  if (!staffId) {
    const params = new URLSearchParams(window.location.search);
    const qId = params.get('id') || params.get('staff_id');
    if (qId && /^\d+$/.test(qId)) {
      staffId = parseInt(qId, 10);
    }
  }

  setupEventListeners();
  setupModalListeners();

  await requireAuth(() => {
    initPage();
  });
});

function setupEventListeners() {
  const retryBtn = document.getElementById('sahRetryBtn');
  if (retryBtn) retryBtn.addEventListener('click', () => loadAllData());

  const refreshBtn = document.getElementById('sahRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const icon = document.getElementById('sahRefreshIcon');
      if (icon) icon.classList.add('animate-spin');
      try {
        await loadAllData();
      } finally {
        if (icon) icon.classList.remove('animate-spin');
      }
    });
  }

  const resetBtn = document.getElementById('sahResetFilter');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const s = document.getElementById('filterStartDate');
      const e = document.getElementById('filterEndDate');
      const m = document.getElementById('filterIoMode');
      if (s) s.value = '';
      if (e) e.value = '';
      if (m) m.value = 'all';
      applyFilters();
    });
  }

  const sInput = document.getElementById('filterStartDate');
  const eInput = document.getElementById('filterEndDate');
  const mSelect = document.getElementById('filterIoMode');
  if (sInput) sInput.addEventListener('change', applyFilters);
  if (eInput) eInput.addEventListener('change', applyFilters);
  if (mSelect) mSelect.addEventListener('change', applyFilters);

  const prevBtn = document.getElementById('sahPrevBtn');
  const nextBtn = document.getElementById('sahNextBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const maxPage = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
      if (currentPage < maxPage) {
        currentPage++;
        renderTable();
      }
    });
  }
}

function setupModalListeners() {
  const overlay = document.getElementById('sahModalOverlay');
  const closeIcon = document.getElementById('sahModalCloseIcon');
  const closeBtn = document.getElementById('sahModalCloseBtn');

  const closeModal = () => {
    if (overlay) overlay.classList.remove('open');
  };

  if (closeIcon) closeIcon.addEventListener('click', closeModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) {
      closeModal();
    }
  });
}

async function initPage() {
  if (!staffId) {
    showError('No valid staff ID was provided in the URL. Please return to the Staff Directory.');
    return;
  }

  // Set Profile link
  const backProfileBtn = document.getElementById('sahBackToProfile');
  if (backProfileBtn) backProfileBtn.href = `/admin/staffs/${staffId}`;
  const breadcrumbProfileLink = document.getElementById('sahBreadcrumbProfileLink');
  if (breadcrumbProfileLink) breadcrumbProfileLink.href = `/admin/staffs/${staffId}`;

  await loadAllData();
}

async function loadAllData() {
  setViewState('loading');

  try {
    // Parallel fetch: staff profile + attendance records from live API
    const [staffRes, attRes] = await Promise.allSettled([
      staffAPI.get(staffId),
      staffAttendanceAPI.getByStaffId(staffId)
    ]);

    // Handle staff profile
    if (staffRes.status === 'fulfilled') {
      const sData = staffRes.value?.data;
      staffMember = sData?.staff || sData;
      renderStaffHeader(staffMember);
    } else {
      console.warn('[StaffAttendanceHistory] Could not load staff profile details:', staffRes.reason);
    }

    // Handle attendance records
    if (attRes.status === 'fulfilled') {
      const aData = attRes.value?.data;
      // Backend wraps records under staff: BiometricAttendanceRecord[]
      const rawRecords = aData?.staff || aData?.data || aData?.results || (Array.isArray(aData) ? aData : []);
      allRecords = Array.isArray(rawRecords) ? rawRecords : [];

      // Sort by attendance_datetime descending (most recent first)
      allRecords.sort((a, b) => {
        const da = new Date(a.attendance_datetime || 0).getTime();
        const db = new Date(b.attendance_datetime || 0).getTime();
        return db - da;
      });

      calculateSummaryMetrics(allRecords);
      applyFilters();
      setViewState('content');
    } else {
      throw attRes.reason || new Error('Failed to retrieve attendance history.');
    }
  } catch (error) {
    console.error('[StaffAttendanceHistory] Failed to load data:', error);
    const statusCode = error.status || error.response?.status;
    let msg;
    if (statusCode === 401) {
      msg = 'Your session has expired. Please sign in again.';
    } else if (statusCode === 403) {
      msg = 'You do not have permission to access attendance records.';
    } else if (statusCode === 404) {
      msg = `No attendance records found for staff ID ${staffId}.`;
    } else {
      msg = `Could not connect to the attendance service: ${error.message}`;
    }
    showError(msg);
  }
}

function renderStaffHeader(staff) {
  if (!staff) return;

  const other = staff.other_names && staff.other_names.trim() ? ` ${staff.other_names.trim()}` : '';
  const fullName = `${staff.first_name || ''}${other} ${staff.last_name || ''}`.trim() || 'Staff Member';
  const initials = staff.first_name ? staff.first_name[0].toUpperCase() : 'S';

  document.title = `${fullName} · Attendance History · Phronesis`;

  setText('sahAvatar', initials);
  setText('sahStaffName', fullName);
  setText('sahStaffNo', staff.staff_no || '—');

  const deptBadge = document.getElementById('sahDeptBadge');
  if (deptBadge) {
    const isTeaching = (staff.department || '').toLowerCase() === 'teaching';
    deptBadge.textContent = staff.department || 'Staff';
    deptBadge.className = 'sah-badge ' + (isTeaching ? 'sah-badge-present' : 'sah-badge-checkout');
  }

  const backProfileBtn = document.getElementById('sahBackToProfile');
  if (backProfileBtn) backProfileBtn.href = `/admin/staffs/${staff.id || staffId}`;
  const breadcrumbProfileLink = document.getElementById('sahBreadcrumbProfileLink');
  if (breadcrumbProfileLink) breadcrumbProfileLink.href = `/admin/staffs/${staff.id || staffId}`;
}

/**
 * Calculates verified metrics from live biometric scans.
 * Multiple scans on the same calendar date are evaluated:
 * - The first check-in of each day determines that day's punctuality (on-time vs late).
 */
function calculateSummaryMetrics(records) {
  const totalEvents = records.length;
  
  // Group check-ins by calendar date (WAT)
  const dayCheckIns = new Map();

  records.forEach(r => {
    const io = Number(r.io_mode);
    if (io === 0) {
      const dateKey = getWATDateKey(r.attendance_datetime);
      if (dateKey) {
        if (!dayCheckIns.has(dateKey)) {
          dayCheckIns.set(dateKey, []);
        }
        dayCheckIns.get(dateKey).push(r);
      }
    }
  });

  let onTimeDays = 0;
  let lateDays = 0;

  dayCheckIns.forEach((scansOnDate) => {
    // Sort ascending to get earliest check-in of the day
    scansOnDate.sort((a, b) => new Date(a.attendance_datetime || 0) - new Date(b.attendance_datetime || 0));
    const earliestCheckIn = scansOnDate[0];
    if (checkIsLate(earliestCheckIn.attendance_datetime)) {
      lateDays++;
    } else {
      onTimeDays++;
    }
  });

  const totalUniqueDays = dayCheckIns.size;

  setText('statTotal', totalEvents);
  setText('statPresent', onTimeDays);
  setText('statLate', lateDays);
  setText('statDays', totalUniqueDays);
}

function applyFilters() {
  const startDate = document.getElementById('filterStartDate')?.value;
  const endDate = document.getElementById('filterEndDate')?.value;
  const ioMode = document.getElementById('filterIoMode')?.value;

  filteredRecords = allRecords.filter(r => {
    const io = Number(r.io_mode);
    const isCheckIn = io === 0;
    const isLate = isCheckIn && checkIsLate(r.attendance_datetime);
    const isOnTime = isCheckIn && !isLate;

    // Filter mode / status
    if (ioMode === '0' && io !== 0) return false;
    if (ioMode === '1' && io !== 1) return false;
    if (ioMode === 'ontime' && !isOnTime) return false;
    if (ioMode === 'late' && !isLate) return false;

    // Filter date range
    if (startDate || endDate) {
      const recordDate = getWATDateKey(r.attendance_datetime);
      if (startDate && recordDate < startDate) return false;
      if (endDate && recordDate > endDate) return false;
    }

    return true;
  });

  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('sahTableBody');
  const emptyState = document.getElementById('sahEmptyState');
  const tableWrapper = document.getElementById('sahTableWrapper');
  const countText = document.getElementById('sahCountText');
  const paginationText = document.getElementById('sahPaginationText');
  const pageIndicator = document.getElementById('sahPageIndicator');
  const prevBtn = document.getElementById('sahPrevBtn');
  const nextBtn = document.getElementById('sahNextBtn');

  if (!tbody) return;

  const total = filteredRecords.length;

  if (total === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (tableWrapper) tableWrapper.classList.add('hidden');
    if (countText) countText.textContent = '0 records';
    if (paginationText) paginationText.textContent = 'Showing 0 of 0 records';
    if (pageIndicator) pageIndicator.textContent = 'Page 1 of 1';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.remove('hidden');

  const maxPage = Math.ceil(total / PAGE_SIZE) || 1;
  if (currentPage > maxPage) currentPage = maxPage;

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageItems = filteredRecords.slice(startIdx, endIdx);

  if (countText) countText.textContent = `${total} records`;
  if (paginationText) paginationText.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${total} records`;
  if (pageIndicator) pageIndicator.textContent = `Page ${currentPage} of ${maxPage}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= maxPage;

  // Render exactly 5 Columns: Date, Time, Event, Attendance Status, Action
  tbody.innerHTML = pageItems.map((r, idx) => {
    const io = Number(r.io_mode);
    const isCheckIn = io === 0;
    const isLate = isCheckIn && checkIsLate(r.attendance_datetime);

    const formattedDate = formatWATDate(r.attendance_datetime);
    const formattedTime = formatWATTime(r.attendance_datetime);

    let eventBadge;
    if (isCheckIn) {
      eventBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-royal border border-blue-200">
        <svg class="w-3 h-3 text-royal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
        Clock-In
      </span>`;
    } else {
      eventBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
        <svg class="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        Clock-Out
      </span>`;
    }

    let statusBadge;
    if (isCheckIn) {
      if (isLate) {
        statusBadge = `<span class="sah-badge sah-badge-late">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Late
        </span>`;
      } else {
        statusBadge = `<span class="sah-badge sah-badge-present">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          Present
        </span>`;
      }
    } else {
      statusBadge = `<span class="sah-badge sah-badge-checkout">
        Check-Out
      </span>`;
    }

    const globalIdx = startIdx + idx;

    return `
      <tr>
        <td class="font-medium text-text-dark whitespace-nowrap">${formattedDate}</td>
        <td class="font-mono text-xs font-bold text-royal-deep whitespace-nowrap">${formattedTime}</td>
        <td>${eventBadge}</td>
        <td>${statusBadge}</td>
        <td class="text-right">
          <button type="button" class="sah-btn-inspect" data-idx="${globalIdx}" title="View details" aria-label="View event details">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Details</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach inspection button listeners
  tbody.querySelectorAll('.sah-btn-inspect').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const record = filteredRecords[idx];
      if (record) openInspectionModal(record);
    });
  });
}

/**
 * Opens simplified event details modal showing ONLY essential attendance data:
 * - Staff Name
 * - Attendance Date
 * - Recorded Time
 * - Event Type
 * - Attendance Status
 */
function openInspectionModal(r) {
  const overlay = document.getElementById('sahModalOverlay');
  if (!overlay) return;

  const io = Number(r.io_mode);
  const isCheckIn = io === 0;
  const isLate = isCheckIn && checkIsLate(r.attendance_datetime);

  const other = staffMember?.other_names && staffMember.other_names.trim() ? ` ${staffMember.other_names.trim()}` : '';
  const fullName = staffMember ? `${staffMember.first_name || ''}${other} ${staffMember.last_name || ''}`.trim() : 'Staff Member';

  setText('mStaffName', fullName);
  setText('mEventDate', formatWATDate(r.attendance_datetime));
  setText('mEventTime', `${formatWATTime(r.attendance_datetime)} WAT`);
  setText('mEventType', isCheckIn ? 'Clock-In (Arrival)' : 'Clock-Out (Departure)');
  setText('mEventStatus', isCheckIn ? (isLate ? 'Late Arrival' : 'Present (On Time)') : 'Check-Out Logged');

  overlay.classList.add('open');
}

// ── Time & Date Helpers (Africa/Lagos WAT = UTC+1) ─────────────────
function getWATDateKey(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }); // returns YYYY-MM-DD
  } catch {
    return (iso || '').slice(0, 10);
  }
}

function formatWATDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      timeZone: 'Africa/Lagos',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return iso;
  }
}

function formatWATTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      timeZone: 'Africa/Lagos',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return iso;
  }
}

function checkIsLate(iso) {
  if (!iso) return false;
  try {
    const d = new Date(iso);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    // Late cutoff: 08:15 AM WAT
    if (hour > 8) return true;
    if (hour === 8 && minute > 15) return true;
    return false;
  } catch {
    return false;
  }
}

// ── View States ───────────────────────────────────────────────────
function setViewState(state) {
  const loading = document.getElementById('sahLoading');
  const error = document.getElementById('sahError');
  const content = document.getElementById('sahContent');

  if (loading) loading.style.display = state === 'loading' ? 'flex' : 'none';
  if (error) error.style.display = state === 'error' ? 'flex' : 'none';
  if (content) content.style.display = state === 'content' ? 'block' : 'none';
}

function showError(msg) {
  setViewState('error');
  setText('sahErrorMsg', msg);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
