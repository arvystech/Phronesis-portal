// admin/assets/js/pages/staff-attendance.js
// Staff Attendance Dashboard — Phronesis Sunesis School ERP
// Connected to Live Backend APIs:
//   - GET /admin/staff-attendance (All biometric records)
//   - GET /admin/staff (All active staff members)

import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { staffAttendanceAPI, staffAPI } from '../api.js';

/* ──────────────────────────────────────────────────────────────────
   ATTENDANCE CONFIGURATION & BUSINESS RULES
   Timezone: School local time is West Africa Time (WAT / UTC+1)
   Resumption Time: 08:00 AM
   Late Threshold:  08:15 AM
   Cutoff Time:     12:00 PM
   Working Days:    Monday – Friday (1 to 5)
────────────────────────────────────────────────────────────────── */
const ATTENDANCE_CONFIG = {
  resumptionTime: '08:00',
  lateThresholdTime: '08:15',
  cutoffTime: '12:00',
  timeZoneOffsetHours: 1, // WAT = UTC+1
  workingDays: [1, 2, 3, 4, 5] // Mon-Fri
};

/* ──────────────────────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────────────────────── */
let rawActiveStaff = [];
let rawAttendanceEvents = [];
let selectedDateStr = ''; // YYYY-MM-DD
let computedDayRecords = [];
let filteredRecords = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let isInitialized = false;

let currentFilter = {
  department: 'All Departments',
  status: 'All Statuses',
  search: ''
};

/* ──────────────────────────────────────────────────────────────────
   ENTRY POINT
────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('staff-attendance', 'Staff Attendance');

  // Ensure modal starts explicitly closed
  closeViewDetailsModal();

  await requireAuth(() => {
    initAttendancePage();
  });
});

async function initAttendancePage() {
  if (isInitialized) return;
  isInitialized = true;

  bindControls();
  await loadAttendanceData();
}

/* ──────────────────────────────────────────────────────────────────
   VIEW STATE CONTROLLER
   Guarantees mutually exclusive visibility of Loading, Error and Content states.
   Explicitly sets inline style.display AND toggles .hidden class.
────────────────────────────────────────────────────────────────── */
function setViewState(state) {
  const loadingEl = document.getElementById('attendanceLoading');
  const errorEl = document.getElementById('attendanceError');
  const contentEl = document.getElementById('attendanceContent');

  if (loadingEl) {
    loadingEl.style.display = state === 'loading' ? 'flex' : 'none';
    loadingEl.classList.toggle('hidden', state !== 'loading');
  }
  if (errorEl) {
    errorEl.style.display = state === 'error' ? 'flex' : 'none';
    errorEl.classList.toggle('hidden', state !== 'error');
  }
  if (contentEl) {
    contentEl.style.display = state === 'content' ? 'block' : 'none';
    contentEl.classList.toggle('hidden', state !== 'content');
  }
}

/* ──────────────────────────────────────────────────────────────────
   DATA LOADING (REAL LIVE API INTEGRATION)
────────────────────────────────────────────────────────────────── */
async function loadAttendanceData() {
  const errorMsg = document.getElementById('attendanceErrorMsg');
  const refreshIcon = document.getElementById('headerRefreshIcon');

  setViewState('loading');
  if (refreshIcon) refreshIcon.classList.add('animate-spin');

  try {
    // 1. Fetch staff directory and biometric events in parallel from live endpoints
    const [staffRes, attRes] = await Promise.all([
      staffAPI.list().catch(err => {
        console.warn('Could not fetch /admin/staff directly, falling back:', err.message);
        return { data: [] };
      }),
      staffAttendanceAPI.list().catch(err => {
        throw new Error(`Failed to load attendance logs: ${err.message}`);
      })
    ]);

    // 2. Process Staff Directory (Denominator)
    const staffData = staffRes?.data?.staff || staffRes?.data?.data || staffRes?.data || [];
    rawActiveStaff = (Array.isArray(staffData) ? staffData : [])
      .filter(s => !s.employment_status || s.employment_status.toLowerCase() === 'active')
      .map(s => ({
        id: s.id,
        staffNo: String(s.staff_no || s.staffNo || '').trim(),
        firstName: String(s.first_name || s.firstName || '').trim(),
        lastName: String(s.last_name || s.lastName || '').trim(),
        otherNames: String(s.other_names || s.otherNames || '').trim(),
        biometricEnrollmentNo: String(s.biometric_enrollment_no !== undefined ? s.biometric_enrollment_no : (s.biometricEnrollmentNo || '')).trim(),
        department: normalizeDepartment(s.department),
        email: s.email || '',
        phone: s.phone || s.phoneNo || '',
      }));

    // Fallback 1: If live staff endpoint returned empty, check localStorage cache from Staffs page
    if (rawActiveStaff.length === 0) {
      try {
        const cached = localStorage.getItem('ps_live_staff_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            rawActiveStaff = parsed;
          }
        }
      } catch (_) {}
    }

    // 3. Process Live Biometric Attendance Records
    const rawEvents = attRes?.data?.data || attRes?.data?.results || attRes?.data || [];
    if (!Array.isArray(rawEvents)) {
      throw new Error('Unexpected API response structure from /admin/staff-attendance.');
    }

    // Filter strictly for staff biometric punches
    rawAttendanceEvents = rawEvents.filter(r => !r.person_type || r.person_type.toLowerCase() === 'staff');

    // Fallback 2: Extract active staff directly from attendance events if directory was empty
    if (rawActiveStaff.length === 0 && rawAttendanceEvents.length > 0) {
      const seenStaff = new Map();
      rawAttendanceEvents.forEach(evt => {
        const id = evt.staff_id || evt.id;
        const bio = String(evt.biometric_enrollment_no || '').trim();
        const key = id ? `id_${id}` : `bio_${bio}`;
        if (key && !seenStaff.has(key)) {
          seenStaff.set(key, {
            id: id,
            staffNo: `PSA-${String(id || '').padStart(3, '0')}`,
            firstName: evt.first_name || '',
            lastName: evt.last_name || '',
            otherNames: '',
            biometricEnrollmentNo: bio,
            department: normalizeDepartment(evt.department),
            email: evt.email || '',
            phone: evt.phone || ''
          });
        }
      });
      rawActiveStaff = Array.from(seenStaff.values());
    }

    // 4. Determine Initial Selected Date
    determineInitialDate();

    // 5. Compute Attendance Register
    computeDailyAttendance();

    // Show Content card
    setViewState('content');
  } catch (error) {
    console.error('Error loading attendance records from live API:', error);
    setViewState('error');
    if (errorMsg) {
      errorMsg.textContent = `Could not load attendance logs (${error.message}). Please click "Retry Request" or check network connectivity.`;
    }
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('animate-spin');
  }
}

/* ──────────────────────────────────────────────────────────────────
   INITIAL DATE DETERMINATION
   Defaults to the date in the database that has records (e.g. 2026-10-05)
   so the administrator immediately sees live records upon loading.
────────────────────────────────────────────────────────────────── */
function determineInitialDate() {
  const dateInput = document.getElementById('attDatePicker');

  // Count punches per date to identify the date with actual attendance activity
  const dateCounts = {};
  rawAttendanceEvents.forEach(e => {
    const dStr = getLocalDateString(e.attendance_datetime);
    if (dStr) dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
  });

  // Sort dates primarily by punch count descending so the day with active staff check-ins is selected
  const datesByActivity = Object.keys(dateCounts).sort((a, b) => {
    return (dateCounts[b] - dateCounts[a]) || b.localeCompare(a);
  });

  const todayStr = getTodayLocalDateString();

  if (!selectedDateStr) {
    if (datesByActivity.includes(todayStr)) {
      selectedDateStr = todayStr;
    } else if (datesByActivity.length > 0) {
      // Pick the date with the most live biometric punches (e.g. 2026-10-05 with 8 records)
      selectedDateStr = datesByActivity[0];
    } else {
      selectedDateStr = todayStr;
    }
  }

  if (dateInput) {
    dateInput.value = selectedDateStr;
  }

  updateSelectedDateHeader();
}

function updateSelectedDateHeader() {
  const label = document.getElementById('selectedDateDisplay');
  if (!label) return;

  if (!selectedDateStr) {
    label.textContent = `All Recorded Logs (${rawAttendanceEvents.length} Events)`;
    return;
  }

  const parts = selectedDateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[d.getDay()];
    label.textContent = `${dayName}, ${formatDateDDMMYYYY(selectedDateStr)}`;
  } else {
    label.textContent = selectedDateStr;
  }
}

/* ──────────────────────────────────────────────────────────────────
   ATTENDANCE STATUS ENGINE
   - Present: First valid check-in <= 08:15 AM
   - Late: First valid check-in > 08:15 AM
   - Absent: No valid check-in by 12:00 PM cutoff on scheduled working days
   - Never mark future dates or non-working days as Absent.
   - When no specific date is selected, lists all attendance events.
────────────────────────────────────────────────────────────────── */
function computeDailyAttendance() {
  if (!selectedDateStr) {
    // ── ALL RECORDS AUDIT LOG MODE ──────────────────────────────────
    computedDayRecords = rawAttendanceEvents.map(evt => {
      const timeObj = extractLocalTime(evt.attendance_datetime);
      const dateStr = getLocalDateString(evt.attendance_datetime);

      const [lateH, lateM] = ATTENDANCE_CONFIG.lateThresholdTime.split(':').map(Number);
      const lateThresholdMinutes = lateH * 60 + lateM;
      const status = timeObj.totalMinutes <= lateThresholdMinutes ? 'Present' : 'Late';

      const fullName = `${evt.first_name || ''} ${evt.last_name || ''}`.trim() || 'Staff Member';

      return {
        staffId: evt.staff_id,
        staffNo: `PSA-${String(evt.staff_id || '').padStart(3, '0')}`,
        fullName: fullName,
        firstName: evt.first_name || '',
        lastName: evt.last_name || '',
        otherNames: '',
        biometricEnrollmentNo: String(evt.biometric_enrollment_no || '').trim(),
        department: normalizeDepartment(evt.department),
        date: dateStr,
        dateFormatted: formatDateDDMMYYYY(dateStr),
        time: timeObj.formatted,
        timeSortKey: timeObj.totalMinutes,
        status: status,
        rawEvent: evt,
        allEvents: [evt],
        email: evt.email || '',
        phone: evt.phone || ''
      };
    });

    updateSummaryCards();
    applyFilters();
    return;
  }

  // ── DAILY REGISTER MODE ─────────────────────────────────────────
  const [year, month, day] = selectedDateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayOfWeek = targetDate.getDay(); // 0 = Sun, 6 = Sat
  const isWorkingDay = ATTENDANCE_CONFIG.workingDays.includes(dayOfWeek);

  const todayStr = getTodayLocalDateString();
  const isFutureDate = selectedDateStr > todayStr;
  const isToday = selectedDateStr === todayStr;

  // Current time in WAT (West Africa Time)
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  const [cutoffH, cutoffM] = ATTENDANCE_CONFIG.cutoffTime.split(':').map(Number);
  const cutoffMinutes = cutoffH * 60 + cutoffM;
  const isPastCutoffToday = currentTimeMinutes >= cutoffMinutes;

  // Filter biometric punches on this specific date
  const eventsOnDate = rawAttendanceEvents.filter(e => {
    return getLocalDateString(e.attendance_datetime) === selectedDateStr;
  });

  // Group events by staff_id and biometric_enrollment_no
  const eventsByStaffId = new Map();
  const eventsByBioNo = new Map();

  eventsOnDate.forEach(evt => {
    if (evt.staff_id) {
      if (!eventsByStaffId.has(Number(evt.staff_id))) eventsByStaffId.set(Number(evt.staff_id), []);
      eventsByStaffId.get(Number(evt.staff_id)).push(evt);
    }
    const bio = String(evt.biometric_enrollment_no || '').trim();
    if (bio) {
      if (!eventsByBioNo.has(bio)) eventsByBioNo.set(bio, []);
      eventsByBioNo.get(bio).push(evt);
    }
  });

  // Chronological sort to resolve first valid check-in
  const sortChronological = (list) => {
    return [...list].sort((a, b) => new Date(a.attendance_datetime) - new Date(b.attendance_datetime));
  };

  computedDayRecords = rawActiveStaff.map(staff => {
    let staffEvents = [];
    if (staff.id && eventsByStaffId.has(Number(staff.id))) {
      staffEvents = eventsByStaffId.get(Number(staff.id));
    } else if (staff.biometricEnrollmentNo && eventsByBioNo.has(staff.biometricEnrollmentNo)) {
      staffEvents = eventsByBioNo.get(staff.biometricEnrollmentNo);
    }

    staffEvents = sortChronological(staffEvents);
    const firstCheckIn = staffEvents.length > 0 ? staffEvents[0] : null;

    let status = 'Absent';
    let checkInTimeDisplay = '—';
    let timeSortKey = 999999;

    if (firstCheckIn) {
      const timeObj = extractLocalTime(firstCheckIn.attendance_datetime);
      checkInTimeDisplay = timeObj.formatted;
      timeSortKey = timeObj.totalMinutes;

      const [lateH, lateM] = ATTENDANCE_CONFIG.lateThresholdTime.split(':').map(Number);
      const lateThresholdMinutes = lateH * 60 + lateM;

      if (timeObj.totalMinutes <= lateThresholdMinutes) {
        status = 'Present';
      } else {
        status = 'Late';
      }
    } else {
      if (isFutureDate) {
        status = 'Unrecorded';
      } else if (!isWorkingDay) {
        status = 'Non-working';
      } else if (isToday && !isPastCutoffToday) {
        status = 'Pending';
      } else {
        status = 'Absent';
      }
    }

    const fullName = `${staff.firstName} ${staff.otherNames ? staff.otherNames + ' ' : ''}${staff.lastName}`.trim();

    return {
      staffId: staff.id,
      staffNo: staff.staffNo,
      fullName: fullName,
      firstName: staff.firstName,
      lastName: staff.lastName,
      otherNames: staff.otherNames,
      biometricEnrollmentNo: staff.biometricEnrollmentNo,
      department: staff.department,
      date: selectedDateStr,
      dateFormatted: formatDateDDMMYYYY(selectedDateStr),
      time: checkInTimeDisplay,
      timeSortKey: timeSortKey,
      status: status,
      rawEvent: firstCheckIn,
      allEvents: staffEvents,
      email: staff.email,
      phone: staff.phone
    };
  });

  updateSummaryCards();
  applyFilters();
}

/* ──────────────────────────────────────────────────────────────────
   SUMMARY CARDS (REAL CALCULATED METRICS)
────────────────────────────────────────────────────────────────── */
function updateSummaryCards() {
  const statTotal = document.getElementById('statTotalStaff');
  const statPresent = document.getElementById('statPresentStaff');
  const statLate = document.getElementById('statLateStaff');
  const statAbsent = document.getElementById('statAbsentStaff');

  if (!selectedDateStr) {
    if (statTotal) statTotal.textContent = (rawActiveStaff.length || computedDayRecords.length).toString();
    const presentCount = computedDayRecords.filter(r => r.status === 'Present').length;
    const lateCount = computedDayRecords.filter(r => r.status === 'Late').length;
    if (statPresent) statPresent.textContent = presentCount.toString();
    if (statLate) statLate.textContent = lateCount.toString();
    if (statAbsent) statAbsent.textContent = '0';
    return;
  }

  const total = rawActiveStaff.length;
  if (statTotal) statTotal.textContent = total.toString();

  const presentCount = computedDayRecords.filter(r => r.status === 'Present').length;
  const lateCount = computedDayRecords.filter(r => r.status === 'Late').length;
  const absentCount = computedDayRecords.filter(r => r.status === 'Absent').length;

  if (statPresent) statPresent.textContent = presentCount.toString();
  if (statLate) statLate.textContent = lateCount.toString();
  if (statAbsent) statAbsent.textContent = absentCount.toString();
}

/* ──────────────────────────────────────────────────────────────────
   FILTERING & SEARCH
────────────────────────────────────────────────────────────────── */
function applyFilters() {
  const dept = currentFilter.department;
  const status = currentFilter.status;
  const query = currentFilter.search.toLowerCase();

  filteredRecords = computedDayRecords.filter(record => {
    // 1. Department Filter
    if (dept !== 'All Departments') {
      if (record.department.toLowerCase() !== dept.toLowerCase()) {
        return false;
      }
    }

    // 2. Status Filter
    if (status !== 'All Statuses') {
      if (record.status.toLowerCase() !== status.toLowerCase()) {
        return false;
      }
    }

    // 3. Search Field (Staff name, biometric enrollment number, staff ID)
    if (query) {
      const nameMatch = record.fullName.toLowerCase().includes(query);
      const bioMatch = record.biometricEnrollmentNo.toLowerCase().includes(query);
      const idMatch = record.staffNo.toLowerCase().includes(query);
      if (!nameMatch && !bioMatch && !idMatch) {
        return false;
      }
    }

    return true;
  });

  const countText = document.getElementById('filteredCountText');
  if (countText) {
    countText.textContent = `${filteredRecords.length} staff ${filteredRecords.length === 1 ? 'record' : 'records'}`;
  }

  const tableSubtitle = document.getElementById('tableSubtitle');
  if (tableSubtitle) {
    if (selectedDateStr) {
      tableSubtitle.textContent = `Displaying records for ${formatDateDDMMYYYY(selectedDateStr)} (${filteredRecords.length} filtered).`;
    } else {
      tableSubtitle.textContent = `Displaying all recorded biometric logs (${filteredRecords.length} records).`;
    }
  }

  renderTable();
  updatePagination();
}

/* ──────────────────────────────────────────────────────────────────
   TABLE RENDERING (EXACTLY 5 MAIN COLUMNS)
   1. Name (with status badge inside)
   2. Biometric Enrollment No.
   3. Department
   4. Date
   5. Time
   + Actions (compact View Details icon button)
────────────────────────────────────────────────────────────────── */
function renderTable() {
  const tbody = document.getElementById('attendanceTableBody');
  const tableContainer = document.getElementById('tableContainer');
  const emptyState = document.getElementById('attendanceEmpty');
  const emptyTitle = document.getElementById('attendanceEmptyTitle');
  const emptyText = document.getElementById('attendanceEmptyText');
  const paginationContainer = document.getElementById('paginationContainer');

  if (!tbody) return;
  tbody.innerHTML = '';

  if (filteredRecords.length === 0) {
    if (tableContainer) {
      tableContainer.style.display = 'none';
      tableContainer.classList.add('hidden');
    }
    if (paginationContainer) {
      paginationContainer.style.display = 'none';
      paginationContainer.classList.add('hidden');
    }
    if (emptyState) {
      emptyState.style.display = 'flex';
      emptyState.classList.remove('hidden');
    }

    if (computedDayRecords.length === 0) {
      if (emptyTitle) emptyTitle.textContent = 'No active staff in directory';
      if (emptyText) emptyText.textContent = 'No active staff records were returned by the backend API.';
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No matching attendance records';
      if (emptyText) emptyText.textContent = 'No staff records match your current filter and search criteria.';
    }
    return;
  }

  if (emptyState) {
    emptyState.style.display = 'none';
    emptyState.classList.add('hidden');
  }
  if (tableContainer) {
    tableContainer.style.display = 'block';
    tableContainer.classList.remove('hidden');
  }
  if (paginationContainer) {
    paginationContainer.style.display = 'flex';
    paginationContainer.classList.remove('hidden');
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRecords = filteredRecords.slice(startIndex, startIndex + PAGE_SIZE);

  pageRecords.forEach(record => {
    const tr = document.createElement('tr');

    // ── COLUMN 1: Name (Includes status badge inside Name cell) ─────────
    const tdName = document.createElement('td');
    const nameBox = document.createElement('div');
    nameBox.style.cssText = 'display: flex; flex-direction: column; gap: 4px; align-items: flex-start;';

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-weight: 700; color: #0D1E4C; font-size: 0.8125rem;';
    nameSpan.textContent = record.fullName;
    nameBox.appendChild(nameSpan);

    const badge = createStatusBadge(record.status);
    nameBox.appendChild(badge);

    tdName.appendChild(nameBox);
    tr.appendChild(tdName);

    // ── COLUMN 2: Biometric Enrollment No. (preserve leading zeros) ─────
    const tdBio = document.createElement('td');
    tdBio.style.cssText = 'font-family: monospace; font-size: 0.75rem; font-weight: 600; color: #1A202C;';
    tdBio.textContent = record.biometricEnrollmentNo || '—';
    tr.appendChild(tdBio);

    // ── COLUMN 3: Department ───────────────────────────────────────────
    const tdDept = document.createElement('td');
    const deptBadge = document.createElement('span');
    const isTeaching = record.department.toLowerCase() === 'teaching';
    deptBadge.className = `att-dept-pill ${isTeaching ? 'teaching' : 'non-teaching'}`;
    deptBadge.textContent = record.department;
    tdDept.appendChild(deptBadge);
    tr.appendChild(tdDept);

    // ── COLUMN 4: Date (DD/MM/YYYY) ────────────────────────────────────
    const tdDate = document.createElement('td');
    tdDate.style.cssText = 'font-family: monospace; font-size: 0.75rem; color: #64748B; white-space: nowrap;';
    tdDate.textContent = record.dateFormatted;
    tr.appendChild(tdDate);

    // ── COLUMN 5: Time (hh:mm A) ───────────────────────────────────────
    const tdTime = document.createElement('td');
    tdTime.style.cssText = 'font-family: monospace; font-size: 0.75rem; font-weight: 600; color: #1A202C; white-space: nowrap;';
    tdTime.textContent = record.time;
    tr.appendChild(tdTime);

    // ── ACTIONS: View Details ──────────────────────────────────────────
    const tdActions = document.createElement('td');
    tdActions.style.cssText = 'text-align: center;';

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'att-action-btn';
    viewBtn.title = 'View biometric punch details';
    viewBtn.setAttribute('aria-label', `View details for ${record.fullName}`);
    viewBtn.innerHTML = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    `;
    viewBtn.addEventListener('click', () => openViewDetailsModal(record));
    tdActions.appendChild(viewBtn);

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

function createStatusBadge(status) {
  const badge = document.createElement('span');
  let pillClass = 'present';
  let label = 'Present';

  if (status === 'Present') {
    pillClass = 'present';
    label = 'Present';
  } else if (status === 'Late') {
    pillClass = 'late';
    label = 'Late';
  } else if (status === 'Absent') {
    pillClass = 'absent';
    label = 'Absent';
  } else if (status === 'Pending') {
    pillClass = 'late';
    label = 'Pending Cutoff';
  } else if (status === 'Non-working') {
    pillClass = 'present';
    label = 'Non-working Day';
  } else {
    pillClass = 'absent';
    label = 'Future Date';
  }

  badge.className = `att-status-pill ${pillClass}`;
  badge.innerHTML = `<span class="att-status-dot"></span><span>${label}</span>`;
  return badge;
}

/* ──────────────────────────────────────────────────────────────────
   PAGINATION
────────────────────────────────────────────────────────────────── */
function updatePagination() {
  const paginationContainer = document.getElementById('paginationContainer');
  const paginationRange = document.getElementById('paginationRange');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const pageIndicator = document.getElementById('pageIndicator');

  const total = filteredRecords.length;
  if (total === 0) {
    if (paginationContainer) paginationContainer.classList.add('hidden');
    return;
  }

  if (paginationContainer) paginationContainer.classList.remove('hidden');

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startRecord = (currentPage - 1) * PAGE_SIZE + 1;
  const endRecord = Math.min(currentPage * PAGE_SIZE, total);

  if (paginationRange) {
    paginationRange.textContent = `Showing ${startRecord}–${endRecord} of ${total} staff records`;
  }

  if (pageIndicator) {
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  }

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

/* ──────────────────────────────────────────────────────────────────
   CONTROLS & EVENT BINDINGS
────────────────────────────────────────────────────────────────── */
function bindControls() {
  const dateInput = document.getElementById('attDatePicker');
  const jumpLatestBtn = document.getElementById('jumpLatestDateBtn');
  const deptFilter = document.getElementById('attDeptFilter');
  const statusFilter = document.getElementById('attStatusFilter');
  const searchInput = document.getElementById('attSearchInput');
  const clearSearchBtn = document.getElementById('attClearSearchBtn');
  const resetFiltersBtn = document.getElementById('attResetFiltersBtn');
  const emptyResetBtn = document.getElementById('attendanceEmptyResetBtn');
  const headerRefreshBtn = document.getElementById('headerRefreshBtn');
  const headerExportBtn = document.getElementById('headerExportBtn');
  const retryBtn = document.getElementById('attendanceRetryBtn');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  // Date selection
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      selectedDateStr = e.target.value;
      updateSelectedDateHeader();
      currentPage = 1;
      computeDailyAttendance();
    });
  }

  // Jump to latest log date button (toggles between active date with records and all records)
  if (jumpLatestBtn) {
    jumpLatestBtn.addEventListener('click', () => {
      // Find date with the highest activity (e.g. 2026-10-05 with 8 records)
      const dateCounts = {};
      rawAttendanceEvents.forEach(e => {
        const dStr = getLocalDateString(e.attendance_datetime);
        if (dStr) dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
      });
      const sortedDates = Object.keys(dateCounts).sort((a, b) => (dateCounts[b] - dateCounts[a]) || b.localeCompare(a));

      if (sortedDates.length > 0) {
        const topDate = sortedDates[0];
        if (selectedDateStr === topDate) {
          // If already on top date, toggle to all recorded logs
          selectedDateStr = '';
          if (dateInput) dateInput.value = '';
          if (window.toast) window.toast.info('Viewing all attendance logs across all dates');
        } else {
          selectedDateStr = topDate;
          if (dateInput) dateInput.value = selectedDateStr;
          if (window.toast) window.toast.info(`Switched to active attendance date (${formatDateDDMMYYYY(selectedDateStr)})`);
        }
        updateSelectedDateHeader();
        currentPage = 1;
        computeDailyAttendance();
      }
    });
  }

  // Department filter
  if (deptFilter) {
    deptFilter.addEventListener('change', (e) => {
      currentFilter.department = e.target.value;
      currentPage = 1;
      applyFilters();
    });
  }

  // Status filter
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentFilter.status = e.target.value;
      currentPage = 1;
      applyFilters();
    });
  }

  // Live search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentFilter.search = e.target.value.trim();
      currentPage = 1;
      if (clearSearchBtn) {
        if (e.target.value.length > 0) {
          clearSearchBtn.classList.remove('hidden');
        } else {
          clearSearchBtn.classList.add('hidden');
        }
      }
      applyFilters();
    });
  }

  // Clear search
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      clearSearchBtn.classList.add('hidden');
      currentFilter.search = '';
      currentPage = 1;
      applyFilters();
    });
  }

  // Reset filters
  const resetHandler = () => {
    if (deptFilter) deptFilter.value = 'All Departments';
    if (statusFilter) statusFilter.value = 'All Statuses';
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.classList.add('hidden');

    currentFilter = {
      department: 'All Departments',
      status: 'All Statuses',
      search: ''
    };
    currentPage = 1;

    // Reset date to active date so records are always displayed
    determineInitialDate();
    computeDailyAttendance();
  };

  if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetHandler);
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetHandler);

  // Pagination navigation
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePagination();
      }
    });
  }

  // Refresh
  if (headerRefreshBtn) {
    headerRefreshBtn.addEventListener('click', () => {
      loadAttendanceData();
    });
  }

  // Retry
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      loadAttendanceData();
    });
  }

  // Export
  if (headerExportBtn) {
    headerExportBtn.addEventListener('click', exportToCsv);
  }

  // Modal event bindings
  bindModalEvents();
}

/* ──────────────────────────────────────────────────────────────────
   ROBUST MODAL LIFECYCLE (FIX FOR STUCK MODAL)
────────────────────────────────────────────────────────────────── */
function bindModalEvents() {
  const closeDetailsBtn = document.getElementById('closeDetailsModalBtn');
  const dismissDetailsBtn = document.getElementById('dismissDetailsModalBtn');
  const detailsModal = document.getElementById('viewDetailsModal');

  // 1. Close button click
  if (closeDetailsBtn) {
    closeDetailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeViewDetailsModal();
    });
  }

  // 2. Dismiss / Cancel button click
  if (dismissDetailsBtn) {
    dismissDetailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeViewDetailsModal();
    });
  }

  // 3. Backdrop click handler (closes when clicking outside the card)
  if (detailsModal) {
    detailsModal.addEventListener('click', (e) => {
      if (e.target === detailsModal) {
        closeViewDetailsModal();
      }
    });
  }

  // 4. Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      closeViewDetailsModal();
    }
  });
}

function openViewDetailsModal(record) {
  const modal = document.getElementById('viewDetailsModal');
  if (!modal) return;

  const avatar = document.getElementById('modalStaffAvatar');
  const name = document.getElementById('modalStaffName');
  const meta = document.getElementById('modalStaffMeta');
  const badgeContainer = document.getElementById('modalStaffStatusBadge');
  const attDate = document.getElementById('modalAttDate');
  const attTime = document.getElementById('modalAttTime');
  const bioNo = document.getElementById('modalBioNo');
  const machineNo = document.getElementById('modalMachineNo');
  const ioMode = document.getElementById('modalIoMode');
  const modeCode = document.getElementById('modalModeCode');
  const sourceFile = document.getElementById('modalSourceFile');
  const importedAt = document.getElementById('modalImportedAt');

  if (avatar) avatar.textContent = record.firstName ? record.firstName[0].toUpperCase() : 'S';
  if (name) name.textContent = record.fullName;
  if (meta) meta.textContent = `${record.department} · Staff ID: ${record.staffNo || 'PSA-' + record.staffId}`;

  if (badgeContainer) {
    badgeContainer.innerHTML = '';
    badgeContainer.appendChild(createStatusBadge(record.status));
  }

  if (attDate) attDate.textContent = record.dateFormatted;
  if (attTime) attTime.textContent = record.time;
  if (bioNo) bioNo.textContent = record.biometricEnrollmentNo || '—';

  const raw = record.rawEvent || {};
  if (machineNo) machineNo.textContent = raw.machine_no !== undefined ? String(raw.machine_no) : '1';
  if (ioMode) ioMode.textContent = raw.io_mode !== undefined ? `${raw.io_mode} (${raw.io_mode === 0 ? 'Check-in' : raw.io_mode === 1 ? 'Check-out' : 'Overtime Punch'})` : '—';
  if (modeCode) modeCode.textContent = raw.mode_code !== undefined ? String(raw.mode_code) : '—';

  const sourceDesc = [
    raw.source_file ? `File: ${raw.source_file}` : '',
    raw.source_record_no ? `Record #: ${raw.source_record_no}` : ''
  ].filter(Boolean).join(' | ');

  if (sourceFile) sourceFile.textContent = sourceDesc || 'Direct biometric stream';
  if (importedAt) importedAt.textContent = raw.imported_at ? new Date(raw.imported_at).toLocaleString() : '—';

  // Explicitly display modal and freeze background scrolling
  modal.style.display = 'flex';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeViewDetailsModal() {
  const modal = document.getElementById('viewDetailsModal');
  if (!modal) return;

  modal.style.display = 'none';
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

/* ──────────────────────────────────────────────────────────────────
   EXPORT TO CSV
────────────────────────────────────────────────────────────────── */
function exportToCsv() {
  if (filteredRecords.length === 0) {
    if (window.toast) window.toast.warning('No records available to export.');
    return;
  }

  const headers = ['Name', 'Biometric Enrollment No', 'Department', 'Date', 'Time', 'Status'];
  const rows = filteredRecords.map(r => [
    `"${r.fullName.replace(/"/g, '""')}"`,
    `"${r.biometricEnrollmentNo}"`,
    `"${r.department}"`,
    `"${r.dateFormatted}"`,
    `"${r.time}"`,
    `"${r.status}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateFileSuffix = selectedDateStr ? selectedDateStr.replace(/-/g, '_') : 'All_Dates';
  a.download = `Staff_Attendance_${dateFileSuffix}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (window.toast) {
    window.toast.success(`Exported ${filteredRecords.length} records to CSV.`);
  }
}

/* ──────────────────────────────────────────────────────────────────
   UTILITY HELPERS
────────────────────────────────────────────────────────────────── */
function normalizeDepartment(rawDept) {
  const d = String(rawDept || '').trim();
  if (d.toLowerCase().includes('non')) return 'Non-teaching';
  if (d) return d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
  return 'Teaching';
}

function getTodayLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDateString(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const utcHours = d.getUTCHours();
    const isNextDay = (utcHours + ATTENDANCE_CONFIG.timeZoneOffsetHours) >= 24;
    const adjustedDate = new Date(d);
    if (isNextDay) {
      adjustedDate.setUTCDate(adjustedDate.getUTCDate() + 1);
    }
    const year = adjustedDate.getUTCFullYear();
    const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (_) {
    return isoString.substring(0, 10);
  }
}

function extractLocalTime(isoString) {
  if (!isoString) return { formatted: '—', totalMinutes: 999999 };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { formatted: '—', totalMinutes: 999999 };

    const utcHours = d.getUTCHours();
    const utcMinutes = d.getUTCMinutes();
    const watHours = (utcHours + ATTENDANCE_CONFIG.timeZoneOffsetHours) % 24;
    const totalMinutes = watHours * 60 + utcMinutes;

    const period = watHours >= 12 ? 'PM' : 'AM';
    const h12 = watHours % 12 || 12;
    const formatted = `${String(h12).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')} ${period}`;

    return { formatted, totalMinutes };
  } catch (_) {
    return { formatted: '—', totalMinutes: 999999 };
  }
}

function formatDateDDMMYYYY(yyyyMmDd) {
  if (!yyyyMmDd) return '—';
  const parts = yyyyMmDd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return yyyyMmDd;
}
