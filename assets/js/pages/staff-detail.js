// assets/js/pages/staff-detail.js
// Staff Details View — connected to Live Backend API.
// Resolves the staff record from the live cache written by staffs.js,
// or fetches directly from the live API if the cache is absent.

import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';

const LIVE_API_ENDPOINT = 'https://api.phronesis-sunesis.com.ng/staff';

let staffId = null;
let currentStaff = null;
let activeTab = 'biodata';



document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('staffs', 'Staff Details');

  // Extract staff ID from query param ?id=STF001 or clean URL path segment
  const params = new URLSearchParams(window.location.search);
  staffId = params.get('id');

  if (!staffId) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    const nonIdNames = ['staffs', 'staff-details.html', 'staff-details', 'staff-detail', 'admin'];
    if (last && !nonIdNames.includes(last.toLowerCase())) {
      staffId = decodeURIComponent(last);
    }
  }

  // Default fallback if no ID supplied
  if (!staffId) {
    staffId = 'STF001';
  }

  // Check if attendance tab should be opened initially
  if (params.get('tab') === 'attendance' || params.get('view') === 'attendance') {
    activeTab = 'attendance';
  }

  await requireAuth(() => {
    initStaffDetail();
  });
});

async function initStaffDetail() {
  bindTabs();
  await loadStaffDetail();
}

function bindTabs() {
  const tabBtns = document.querySelectorAll('[data-tab-btn]');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab-btn');
      switchTab(tab);
    });
  });

  // Activate initial tab
  switchTab(activeTab);
}

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('[data-tab-btn]').forEach(btn => {
    const target = btn.getAttribute('data-tab-btn');
    if (target === tabName) {
      btn.className = 'px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 border-gold text-royal bg-white transition-all';
    } else {
      btn.className = 'px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-text-soft hover:text-royal transition-all';
    }
  });

  document.querySelectorAll('[data-tab-pane]').forEach(pane => {
    const target = pane.getAttribute('data-tab-pane');
    if (target === tabName) {
      pane.classList.remove('hidden');
    } else {
      pane.classList.add('hidden');
    }
  });
}

async function loadStaffDetail() {
  const loadingEl = document.getElementById('staffDetailLoading');
  const contentEl = document.getElementById('staffDetailContent');
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

      // Defensive extraction — handle array root, result.data, result.staff, result.results
      let rawList = null;
      if (Array.isArray(result)) rawList = result;
      else if (Array.isArray(result.staff)) rawList = result.staff;
      else if (Array.isArray(result.data)) rawList = result.data;
      else if (Array.isArray(result.results)) rawList = result.results;

      if (rawList && rawList.length > 0) {
        // Normalise so lookup fields are consistent with what staffs.js writes
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
          phone: raw.phone || raw.phoneNo || '',
          role: raw.role || '',
          joinedDate: raw.joinedDate || raw.joined_date || '',
          gender: raw.gender || '',
          phoneNo: raw.phoneNo || raw.phone_no || raw.phone || '',
          qualification: raw.qualification || '',
          stateOfOrigin: raw.stateOfOrigin || raw.state_of_origin || '',
          address: raw.address || '',
          status: raw.status || 'Active',
        })).filter(s => s.staffNo);

        // Persist for future navigations in this session
        try {
          localStorage.setItem('ps_live_staff_cache', JSON.stringify(dataset));
        } catch (_) {}
      }
    } catch (err) {
      console.error('[Phronesis] Could not load staff from live API:', err.message);
      // dataset remains null — handled below
    }
  }

  if (loadingEl) loadingEl.classList.add('hidden');

  // ── Step 3: No data available — show not-found rather than fake records ─
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

  renderStaffDetails(currentStaff);
}

function renderStaffDetails(staff) {
  const other = staff.otherNames && staff.otherNames.trim() ? ` ${staff.otherNames.trim()}` : '';
  const fullName = `${staff.firstName}${other} ${staff.lastName}`;

  // Avatar initial
  const initials = staff.firstName ? staff.firstName[0].toUpperCase() : 'S';
  const avatarEl = document.getElementById('detailAvatar');
  if (avatarEl) avatarEl.textContent = initials;

  // Header info
  const nameEl = document.getElementById('detailFullName');
  if (nameEl) nameEl.textContent = fullName;

  const staffNoChip = document.getElementById('detailStaffNoChip');
  if (staffNoChip) staffNoChip.textContent = staff.staffNo;

  const roleEl = document.getElementById('detailRole');
  if (roleEl) roleEl.textContent = staff.role || (staff.department === 'Teaching' ? 'Teaching Staff' : 'Administrative Staff');

  // Department badge (Teaching: Green, Non-teaching: Blue)
  const deptBadge = document.getElementById('detailDeptBadge');
  const isTeaching = (staff.department || '').toLowerCase() === 'teaching';
  if (deptBadge) {
    deptBadge.textContent = staff.department;
    deptBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border';
    if (isTeaching) {
      deptBadge.style.backgroundColor = '#DCFCE7';
      deptBadge.style.color = '#166534';
      deptBadge.style.borderColor = '#BBF7D0';
    } else {
      deptBadge.style.backgroundColor = '#DBEAFE';
      deptBadge.style.color = '#1D4ED8';
      deptBadge.style.borderColor = '#BFDBFE';
    }
  }

  // Biodata Fields (Safe textContent)
  setText('fStaffNo', staff.staffNo);
  setText('fFirstName', staff.firstName);
  setText('fLastName', staff.lastName);
  setText('fOtherNames', staff.otherNames && staff.otherNames.trim() ? staff.otherNames.trim() : '—');
  setText('fBioNo', staff.biometricEnrollmentNo);
  setText('fDepartment', staff.department);
  setText('fPhone', staff.phoneNo || '—');
  setText('fEmail', staff.email && staff.email.trim() ? staff.email.trim() : '—');
  setText('fRole', staff.role || (isTeaching ? 'Subject Teacher' : 'Non-teaching Staff'));
  setText('fJoinedDate', staff.joinedDate || '2022-09-01');

  // Attendance tab staff name & dedicated links
  setText('attTabStaffName', fullName);
  setText('attTabStaffNo', staff.staffNo);

  const attendanceUrl = `staff-attendance.html?id=${encodeURIComponent(staff.staffNo)}`;
  const detailAttendanceLink = document.getElementById('detailAttendanceLink');
  if (detailAttendanceLink) detailAttendanceLink.href = attendanceUrl;

  const tabAttendanceFullLink = document.getElementById('tabAttendanceFullLink');
  if (tabAttendanceFullLink) tabAttendanceFullLink.href = attendanceUrl;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
