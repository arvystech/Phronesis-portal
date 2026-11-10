// admin/assets/js/pages/staff-detail.js
// Staff Details — fetches individual staff via GET /admin/staff/{id}

import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { staffAPI } from '../api.js';

let staffId = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('staffs', 'Staff Details');

  // Extract numeric ID from clean URL path: /admin/staffs/17
  const parts = window.location.pathname.split('/').filter(Boolean);
  // parts = ['admin', 'staffs', '17']
  const rawId = parts[parts.length - 1];
  if (rawId && /^\d+$/.test(rawId)) {
    staffId = parseInt(rawId, 10);
  }

  // Fallback: query param ?id=17
  if (!staffId) {
    const params = new URLSearchParams(window.location.search);
    const qId = params.get('id');
    if (qId && /^\d+$/.test(qId)) {
      staffId = parseInt(qId, 10);
    }
  }

  await requireAuth(() => {
    initStaffDetail();
  });
});

async function initStaffDetail() {
  if (!staffId) {
    showError('No valid staff ID provided in the URL. Please go back and select a staff member.');
    return;
  }
  await loadStaffDetail();
}

async function loadStaffDetail() {
  const loadingEl = document.getElementById('staffDetailLoading');
  const contentEl = document.getElementById('staffDetailContent');
  const errorEl = document.getElementById('staffDetailError');
  const errorMsgEl = document.getElementById('staffDetailErrorMsg');

  if (loadingEl) { loadingEl.style.display = 'flex'; loadingEl.classList.remove('hidden'); }
  if (contentEl) { contentEl.style.display = 'none'; contentEl.classList.add('hidden'); }
  if (errorEl) { errorEl.style.display = 'none'; errorEl.classList.add('hidden'); }

  try {
    const { data } = await staffAPI.get(staffId);
    // Response: { success, staff: StaffMember }
    const staff = data?.staff || data;

    if (!staff || !staff.id) {
      showError(`Staff member with ID ${staffId} was not found in the database.`);
      return;
    }

    if (loadingEl) { loadingEl.style.display = 'none'; loadingEl.classList.add('hidden'); }
    if (contentEl) { contentEl.style.display = 'block'; contentEl.classList.remove('hidden'); }

    renderStaffDetails(staff);
  } catch (error) {
    console.error('[StaffDetail] Load failed:', error);
    if (loadingEl) { loadingEl.style.display = 'none'; loadingEl.classList.add('hidden'); }
    const statusCode = error.status || error.response?.status;
    let msg;
    if (statusCode === 401) {
      msg = 'Your session has expired. Please log in again.';
    } else if (statusCode === 403) {
      msg = 'You do not have permission to view this staff member\'s details.';
    } else if (statusCode === 404) {
      msg = `Staff member with ID ${staffId} was not found.`;
    } else {
      msg = `Could not load staff details: ${error.message}`;
    }
    showError(msg);
  }
}

function showError(message) {
  const loadingEl = document.getElementById('staffDetailLoading');
  const contentEl = document.getElementById('staffDetailContent');
  const errorEl = document.getElementById('staffDetailError');
  const errorMsgEl = document.getElementById('staffDetailErrorMsg');

  if (loadingEl) { loadingEl.style.display = 'none'; loadingEl.classList.add('hidden'); }
  if (contentEl) { contentEl.style.display = 'none'; contentEl.classList.add('hidden'); }
  if (errorEl) { errorEl.style.display = 'flex'; errorEl.classList.remove('hidden'); }
  if (errorMsgEl) errorMsgEl.textContent = message;
}

function renderStaffDetails(staff) {
  const other = staff.other_names && staff.other_names.trim() ? ` ${staff.other_names.trim()}` : '';
  const fullName = `${staff.first_name || ''}${other} ${staff.last_name || ''}`.trim();
  const initials = staff.first_name ? staff.first_name[0].toUpperCase() : 'S';
  const isTeaching = (staff.department || '').toLowerCase() === 'teaching';

  // Update page title
  document.title = `${fullName} · Staff Details · Phronesis`;

  // Avatar
  setText('detailAvatar', initials);

  // Header
  setText('detailFullName', fullName || '—');
  setText('detailStaffNoChip', staff.staff_no || '—');
  setText('detailRole', isTeaching ? 'Teaching Staff' : 'Non-Teaching Staff');

  // Department badge
  const deptBadge = document.getElementById('detailDeptBadge');
  if (deptBadge) {
    const dept = staff.department || '—';
    deptBadge.textContent = dept;
    deptBadge.className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border';
    if (isTeaching) {
      Object.assign(deptBadge.style, { backgroundColor: '#DCFCE7', color: '#166534', borderColor: '#BBF7D0' });
    } else {
      Object.assign(deptBadge.style, { backgroundColor: '#DBEAFE', color: '#1D4ED8', borderColor: '#BFDBFE' });
    }
  }

  // Employment status badge
  const statusBadge = document.getElementById('detailStatusBadge');
  if (statusBadge) {
    const status = (staff.employment_status || 'active').toLowerCase();
    const statusMap = {
      active: { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0', label: 'Active' },
      inactive: { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB', label: 'Inactive' },
      suspended: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A', label: 'Suspended' },
      resigned: { bg: '#FFE4E6', color: '#BE123C', border: '#FECDD3', label: 'Resigned' },
      terminated: { bg: '#FFE4E6', color: '#BE123C', border: '#FECDD3', label: 'Terminated' },
    };
    const s = statusMap[status] || statusMap.active;
    statusBadge.textContent = s.label;
    statusBadge.className = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border';
    Object.assign(statusBadge.style, { backgroundColor: s.bg, color: s.color, borderColor: s.border });
  }

  // Attendance link
  const attendanceUrl = `/admin/staffs/${staff.id}/attendance`;
  const attendanceLink = document.getElementById('detailAttendanceLink');
  if (attendanceLink) attendanceLink.href = attendanceUrl;

  const footerAttendanceLink = document.getElementById('footerAttendanceLink');
  if (footerAttendanceLink) footerAttendanceLink.href = attendanceUrl;

  // Info fields — only display what the API returned
  setField('fId', staff.id);
  setField('fStaffNo', staff.staff_no);
  setField('fFirstName', staff.first_name);
  setField('fLastName', staff.last_name);
  setField('fOtherNames', staff.other_names);
  setField('fBioNo', staff.biometric_enrollment_no);
  setField('fDepartment', staff.department);
  setField('fEmail', staff.email);
  setField('fPhone', staff.phone);
  setField('fStatus', staff.employment_status ? capitalise(staff.employment_status) : null);
  setField('fCreatedAt', staff.created_at ? formatDateTime(staff.created_at) : null);
  setField('fUpdatedAt', staff.updated_at ? formatDateTime(staff.updated_at) : null);
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value !== null && value !== undefined && String(value).trim() !== '') {
    el.textContent = String(value).trim();
    el.classList.remove('field-empty');
  } else {
    el.textContent = '—';
    el.classList.add('field-empty');
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}

function formatDateTime(isoString) {
  if (!isoString) return null;
  try {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return isoString; }
}

// Retry and Refresh buttons
document.addEventListener('DOMContentLoaded', () => {
  const retryBtn = document.getElementById('staffDetailRetryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => loadStaffDetail());
  }

  const refreshBtn = document.getElementById('staffDetailRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const icon = document.getElementById('staffDetailRefreshIcon');
      if (icon) icon.classList.add('animate-spin');
      try {
        await loadStaffDetail();
      } finally {
        if (icon) icon.classList.remove('animate-spin');
      }
    });
  }
});
