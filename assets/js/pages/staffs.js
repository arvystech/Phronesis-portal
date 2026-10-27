// assets/js/pages/staffs.js
// Staffs Management Page — Phronesis Sunesis School ERP
// Connected to Live Backend API: https://api.phronesis-sunesis.com.ng/staff

import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';

/* ──────────────────────────────────────────────────────────────────
   CONFIG & ENDPOINTS
────────────────────────────────────────────────────────────────── */
const LIVE_API_ENDPOINT = 'https://api.phronesis-sunesis.com.ng/staff';

/* ──────────────────────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────────────────────── */
let allStaffRecords = [];
let filteredRecords = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let isInitialized = false;

let currentFilter = {
  search: '',
  department: 'All Departments'
};

/* ──────────────────────────────────────────────────────────────────
   ENTRY POINT
────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('staffs', 'Staffs');

  await requireAuth(() => {
    initStaffsPage();
  });
});

async function initStaffsPage() {
  if (isInitialized) return;
  isInitialized = true;

  bindControls();
  await loadStaffRecords();
}

/* ──────────────────────────────────────────────────────────────────
   DATA EXTRACTION & NORMALIZATION LAYER
────────────────────────────────────────────────────────────────── */
function extractStaffRecords(apiResponse) {
  if (!apiResponse) return [];
  if (Array.isArray(apiResponse)) return apiResponse;
  if (Array.isArray(apiResponse.staff)) return apiResponse.staff;
  if (Array.isArray(apiResponse.data)) return apiResponse.data;
  if (Array.isArray(apiResponse.results)) return apiResponse.results;
  return [];
}

function normalizeStaffRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Department normalization:
  // "Teaching" -> "Teaching"
  // "Non-Teaching" or "Non-teaching" -> "Non-teaching"
  const rawDept = String(raw.department || '').trim();
  let normalizedDept = 'Teaching';
  if (rawDept.toLowerCase().includes('non')) {
    normalizedDept = 'Non-teaching';
  } else if (rawDept) {
    normalizedDept = rawDept.charAt(0).toUpperCase() + rawDept.slice(1).toLowerCase();
  }

  // Preserve biometric enrollment number as string so leading zeros are not lost
  let bioNo = '';
  if (raw.biometric_enrollment_no !== undefined && raw.biometric_enrollment_no !== null) {
    bioNo = String(raw.biometric_enrollment_no).trim();
  } else if (raw.biometricEnrollmentNo !== undefined && raw.biometricEnrollmentNo !== null) {
    bioNo = String(raw.biometricEnrollmentNo).trim();
  }

  const otherNames = (raw.other_names || raw.otherNames || '').trim();

  return {
    id: raw.id ?? raw.staff_no,
    staffNo: String(raw.staff_no || raw.staffNo || '').trim(),
    firstName: String(raw.first_name || raw.firstName || '').trim(),
    lastName: String(raw.last_name || raw.lastName || '').trim(),
    otherNames: otherNames,
    biometricEnrollmentNo: bioNo,
    department: normalizedDept,
    email: raw.email || '',
    phone: raw.phone || raw.phoneNo || '',
    employmentStatus: raw.employment_status || 'active'
  };
}

/* ──────────────────────────────────────────────────────────────────
   DATA LOADING (LIVE API)
────────────────────────────────────────────────────────────────── */
async function loadStaffRecords() {
  const loadingEl = document.getElementById('staffsLoading');
  const contentEl = document.getElementById('staffsContent');
  const errorEl = document.getElementById('staffsError');
  const errorMsg = document.getElementById('staffsErrorMsg');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (contentEl) contentEl.classList.add('hidden');
  if (errorEl) errorEl.classList.add('hidden');

  try {
    const response = await fetch(LIVE_API_ENDPOINT, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response || !response.ok) {
      throw new Error(`HTTP ${response ? response.status : 'network error'}`);
    }

    const result = await response.json();
    const rawStaffList = extractStaffRecords(result);

    if (!Array.isArray(rawStaffList)) {
      throw new Error('The API response does not contain a valid staff array.');
    }

    allStaffRecords = rawStaffList.map(normalizeStaffRecord).filter(Boolean);

    // Save live staff records to cache for use by details/attendance pages
    try {
      localStorage.setItem('ps_live_staff_cache', JSON.stringify(allStaffRecords));
    } catch (_) {}

    if (contentEl) contentEl.classList.remove('hidden');

    applyFilters();
  } catch (error) {
    console.error('Unable to load staff records from live API:', error);
    if (contentEl) contentEl.classList.add('hidden');
    if (errorEl) {
      errorEl.classList.remove('hidden');
      if (errorMsg) {
        let msg = `Could not load staff records from the live backend (${error.message}).`;
        if (window.location.protocol === 'file:') {
          msg = 'Direct file opening (file://) is restricted by browser security (CORS). Requests to external APIs or local modules are blocked. The backend API must permit CORS origin "null" or the site must be served via HTTP/HTTPS.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('network error')) {
          msg = `Network or CORS error connecting to ${LIVE_API_ENDPOINT}. Ensure the backend API enables Access-Control-Allow-Origin headers.`;
        }
        errorMsg.textContent = msg;
      }
    }
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

/* ──────────────────────────────────────────────────────────────────
   EVENT LISTENERS & CONTROLS
────────────────────────────────────────────────────────────────── */
function bindControls() {
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const departmentFilter = document.getElementById('departmentFilter');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const emptyResetBtn = document.getElementById('emptyResetBtn');

  // Live search input
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

  // Clear search button
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

  // Department filter
  if (departmentFilter) {
    departmentFilter.addEventListener('change', (e) => {
      currentFilter.department = e.target.value;
      currentPage = 1;
      applyFilters();
    });
  }

  // Reset filters button
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      resetAllFilters();
    });
  }

  // Reset filters button inside empty state
  if (emptyResetBtn) {
    emptyResetBtn.addEventListener('click', () => {
      resetAllFilters();
    });
  }

  // Pagination Previous / Next buttons
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
        updateSummaryCards();
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
        updateSummaryCards();
      }
    });
  }

  // Retry button in error banner
  const retryBtn = document.getElementById('staffsRetryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      loadStaffRecords();
    });
  }
}

function resetAllFilters() {
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const departmentFilter = document.getElementById('departmentFilter');

  if (searchInput) searchInput.value = '';
  if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
  if (departmentFilter) departmentFilter.value = 'All Departments';

  currentFilter.search = '';
  currentFilter.department = 'All Departments';
  currentPage = 1;

  applyFilters();
}

/* ──────────────────────────────────────────────────────────────────
   FILTERING LOGIC
────────────────────────────────────────────────────────────────── */
function applyFilters() {
  const query = currentFilter.search.toLowerCase();
  const dept = currentFilter.department;

  filteredRecords = allStaffRecords.filter((staff) => {
    // 1. Department Filter
    if (dept !== 'All Departments') {
      if ((staff.department || '').toLowerCase() !== dept.toLowerCase()) {
        return false;
      }
    }

    // 2. Search Input Match (staffNo, firstName, lastName, otherNames)
    if (query) {
      const staffNo = (staff.staffNo || '').toLowerCase();
      const firstName = (staff.firstName || '').toLowerCase();
      const lastName = (staff.lastName || '').toLowerCase();
      const otherNames = (staff.otherNames || '').toLowerCase();

      const matchesStaffNo = staffNo.includes(query);
      const matchesFirstName = firstName.includes(query);
      const matchesLastName = lastName.includes(query);
      const matchesOtherNames = otherNames.includes(query);

      if (!matchesStaffNo && !matchesFirstName && !matchesLastName && !matchesOtherNames) {
        return false;
      }
    }

    return true;
  });

  renderTable();
  updatePagination();
  updateSummaryCards();
}

/* ──────────────────────────────────────────────────────────────────
   SUMMARY CARDS
   Dynamically computed from actual fetched staff records
────────────────────────────────────────────────────────────────── */
function updateSummaryCards() {
  const totalStaffEl = document.getElementById('statTotalStaff');
  const teachingStaffEl = document.getElementById('statTeachingStaff');
  const nonTeachingStaffEl = document.getElementById('statNonTeachingStaff');
  const currentlyDisplayedEl = document.getElementById('statCurrentlyDisplayed');

  // 1. Total Staff: count of records from the live API
  const total = allStaffRecords.length;
  if (totalStaffEl) totalStaffEl.textContent = total.toString();

  // 2. Teaching Staff: count of teaching records from the live API
  const teachingTotal = allStaffRecords.filter(s => (s.department || '').toLowerCase() === 'teaching').length;
  if (teachingStaffEl) teachingStaffEl.textContent = teachingTotal.toString();

  // 3. Non-teaching Staff: count of non-teaching records from the live API
  const nonTeachingTotal = allStaffRecords.filter(s => (s.department || '').toLowerCase() === 'non-teaching').length;
  if (nonTeachingStaffEl) nonTeachingStaffEl.textContent = nonTeachingTotal.toString();

  // 4. Currently Displayed: number of records currently rendered on page
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRecords = filteredRecords.slice(startIndex, startIndex + PAGE_SIZE);
  if (currentlyDisplayedEl) currentlyDisplayedEl.textContent = pageRecords.length.toString();
}

/* ──────────────────────────────────────────────────────────────────
   TABLE RENDERING
   Exact column order:
   1. S/N
   2. Staff No.
   3. First Name
   4. Last Name
   5. Other Names
   6. Biometric Enrollment No.
   7. Department
   8. Actions
────────────────────────────────────────────────────────────────── */
function renderTable() {
  const tbody = document.getElementById('staffTableBody');
  const tableContainer = document.getElementById('tableContainer');
  const emptyState = document.getElementById('emptyState');
  const emptyTitle = document.getElementById('emptyStateTitle');
  const emptyText = document.getElementById('emptyStateText');
  const emptyResetBtn = document.getElementById('emptyResetBtn');
  const paginationContainer = document.getElementById('paginationContainer');

  if (!tbody) return;

  tbody.innerHTML = '';

  // Empty state handling
  if (filteredRecords.length === 0) {
    if (tableContainer) tableContainer.classList.add('hidden');
    if (paginationContainer) paginationContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');

    if (allStaffRecords.length === 0) {
      if (emptyTitle) emptyTitle.textContent = 'No staff records available';
      if (emptyText) emptyText.textContent = 'The live database returned zero staff records.';
      if (emptyResetBtn) emptyResetBtn.classList.add('hidden');
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No matching staff found';
      if (emptyText) emptyText.textContent = 'Try another search term or change the department filter.';
      if (emptyResetBtn) emptyResetBtn.classList.remove('hidden');
    }
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (tableContainer) tableContainer.classList.remove('hidden');
  if (paginationContainer) paginationContainer.classList.remove('hidden');

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRecords = filteredRecords.slice(startIndex, startIndex + PAGE_SIZE);

  pageRecords.forEach((staff, index) => {
    // 1. S/N: sequential serial number for currently displayed page
    const serialNumber = startIndex + index + 1;

    const tr = document.createElement('tr');

    // 1. S/N
    const tdSN = document.createElement('td');
    tdSN.className = 'staffs-col-sn staffs-cell-sn';
    tdSN.textContent = serialNumber.toString();
    tr.appendChild(tdSN);

    // 2. Staff No. (preserve text / leading zeros)
    const tdStaffNo = document.createElement('td');
    tdStaffNo.className = 'staffs-col-staff-no staffs-cell-staff-no';
    tdStaffNo.textContent = String(staff.staffNo || '');
    tr.appendChild(tdStaffNo);

    // 3. First Name
    const tdFirstName = document.createElement('td');
    tdFirstName.className = 'staffs-col-first-name staffs-cell-first-name';
    tdFirstName.textContent = staff.firstName || '';
    tr.appendChild(tdFirstName);

    // 4. Last Name
    const tdLastName = document.createElement('td');
    tdLastName.className = 'staffs-col-last-name staffs-cell-last-name';
    tdLastName.textContent = staff.lastName || '';
    tr.appendChild(tdLastName);

    // 5. Other Names (display dash if empty/missing)
    const tdOtherNames = document.createElement('td');
    tdOtherNames.className = 'staffs-col-other-names staffs-cell-other-names';
    if (staff.otherNames && staff.otherNames.trim() !== '') {
      tdOtherNames.textContent = staff.otherNames.trim();
    } else {
      tdOtherNames.textContent = '—';
      tdOtherNames.classList.add('empty-dash');
    }
    tr.appendChild(tdOtherNames);

    // 6. Biometric Enrollment No. (preserve leading zeros as text)
    const tdBio = document.createElement('td');
    tdBio.className = 'staffs-col-bio staffs-cell-bio';
    tdBio.textContent = staff.biometricEnrollmentNo ? String(staff.biometricEnrollmentNo) : '—';
    tr.appendChild(tdBio);

    // 7. Department (Badges: Teaching = GREEN, Non-teaching = BLUE)
    const tdDept = document.createElement('td');
    tdDept.className = 'staffs-col-dept';
    const isTeaching = (staff.department || '').toLowerCase() === 'teaching';

    const badge = document.createElement('span');
    if (isTeaching) {
      badge.className = 'staffs-dept-badge staffs-badge-teaching';
      badge.style.cssText = 'background-color: #DCFCE7 !important; color: #166534 !important; border: 1px solid #BBF7D0 !important; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; line-height: 1.2;';
      badge.innerHTML = '<span class="staffs-badge-dot" style="width: 6px; height: 6px; border-radius: 9999px; background-color: #166534; display: inline-block;" aria-hidden="true"></span>Teaching';
    } else {
      badge.className = 'staffs-dept-badge staffs-badge-nonteaching';
      badge.style.cssText = 'background-color: #DBEAFE !important; color: #1D4ED8 !important; border: 1px solid #BFDBFE !important; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; line-height: 1.2;';
      badge.innerHTML = '<span class="staffs-badge-dot" style="width: 6px; height: 6px; border-radius: 9999px; background-color: #1D4ED8; display: inline-block;" aria-hidden="true"></span>Non-teaching';
    }
    tdDept.appendChild(badge);
    tr.appendChild(tdDept);

    // 8. Actions (Compact 36x36px icon buttons: View Details & View Attendance)
    const tdActions = document.createElement('td');
    tdActions.className = 'staffs-col-actions';

    const actionGroup = document.createElement('div');
    actionGroup.className = 'staffs-actions-group';
    actionGroup.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; gap: 8px;';

    // Action A: View Details (Eye icon)
    const viewBtn = document.createElement('a');
    viewBtn.href = `staff-details.html?id=${encodeURIComponent(staff.staffNo)}`;
    viewBtn.className = 'staffs-action-btn staffs-btn-details';
    viewBtn.style.cssText = 'width: 36px; height: 36px; min-width: 36px; min-height: 36px; max-width: 36px; max-height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-radius: 8px; background-color: #FFFFFF; border: 1px solid #E7E1D1; color: #17338F; text-decoration: none; box-sizing: border-box;';
    viewBtn.setAttribute('title', 'View staff details');
    viewBtn.setAttribute('aria-label', `View staff details for ${staff.firstName} ${staff.lastName}`);
    viewBtn.innerHTML = `
      <svg style="width: 16px; height: 16px; min-width: 16px; min-height: 16px; display: block;" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    `;
    actionGroup.appendChild(viewBtn);

    // Action B: View Attendance (Calendar icon)
    const attendanceBtn = document.createElement('a');
    attendanceBtn.href = `staff-attendance.html?id=${encodeURIComponent(staff.staffNo)}`;
    attendanceBtn.className = 'staffs-action-btn staffs-btn-attendance';
    attendanceBtn.style.cssText = 'width: 36px; height: 36px; min-width: 36px; min-height: 36px; max-width: 36px; max-height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-radius: 8px; background-color: #FFFFFF; border: 1px solid #E7E1D1; color: #667085; text-decoration: none; box-sizing: border-box;';
    attendanceBtn.setAttribute('title', 'View attendance log');
    attendanceBtn.setAttribute('aria-label', `View attendance log for ${staff.firstName} ${staff.lastName}`);
    attendanceBtn.innerHTML = `
      <svg style="width: 16px; height: 16px; min-width: 16px; min-height: 16px; display: block;" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    `;
    actionGroup.appendChild(attendanceBtn);

    tdActions.appendChild(actionGroup);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
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

  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }

  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
  }
}
