// assets/js/pages/register-staff.js
// Staff Registration page — frontend-only demonstration.
// No backend requests are made. All data stays in memory only.

import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';

/* ──────────────────────────────────────────────────────────────────
   FORM STATE
   Holds trimmed values used for validation and the preview.
────────────────────────────────────────────────────────────────── */
const formState = {
  staffNo: '',
  firstName: '',
  lastName: '',
  otherNames: '',
  biometricNo: '',
  email: '',
  phoneNo: '',
  department: '',
};

/* ──────────────────────────────────────────────────────────────────
   FIELD DEFINITIONS
────────────────────────────────────────────────────────────────── */
const REQUIRED_FIELDS = ['staffNo', 'biometricNo', 'firstName', 'lastName', 'phoneNo', 'department'];
const OPTIONAL_FIELDS = ['otherNames', 'email'];
const ALL_FIELDS      = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

/* ──────────────────────────────────────────────────────────────────
   ENTRY POINT
────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('staffs', 'Register Staff');

  await requireAuth(() => {
    initPage();
  });
});

function initPage() {
  bindInputListeners();
  bindFormSubmit();
  bindClearForm();
  bindPreviewModal();
  updateCompletion();
}

/* ──────────────────────────────────────────────────────────────────
   INPUT LISTENERS  (real-time validation on blur; clear on input)
────────────────────────────────────────────────────────────────── */
function bindInputListeners() {
  ALL_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Sync state on every keystroke
    el.addEventListener('input', () => {
      syncState();
      // Clear error while user is actively editing
      clearFieldError(id);
      updateCompletion();
    });

    // Validate on blur for required fields
    el.addEventListener('blur', () => {
      syncState();
      validateField(id);
      updateCompletion();
    });

    // Select elements also need 'change'
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', () => {
        syncState();
        clearFieldError(id);
        validateField(id);
        updateCompletion();
      });
    }
  });
}

/** Copy trimmed values from DOM into formState. */
function syncState() {
  ALL_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) formState[id] = el.value.trim();
  });
}

/* ──────────────────────────────────────────────────────────────────
   VALIDATION RULES
────────────────────────────────────────────────────────────────── */

/** Email format – basic RFC-compliant surface check. */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Phone: allow Nigerian (070/080/090/091 + 8 digits) and
 * international formats (+country-code …). Min 7 digits total.
 * Permits spaces, hyphens, parentheses, and leading +/0.
 */
function isValidPhone(value) {
  const stripped = value.replace(/[\s\-().]/g, '');
  // Must be at least 7 digits, only digit chars + optional leading +
  return /^\+?\d{7,15}$/.test(stripped);
}

/**
 * Validate a single field.
 * @returns {string} — empty string if valid, error message if invalid.
 */
function getFieldError(id) {
  const value = formState[id];

  switch (id) {
    case 'staffNo':
      if (!value) return 'Please enter a staff number.';
      return '';

    case 'firstName':
      if (!value) return 'Please enter the first name.';
      return '';

    case 'lastName':
      if (!value) return 'Please enter the last name.';
      return '';

    case 'biometricNo':
      if (!value) return 'Please enter the biometric enrollment number.';
      return '';

    case 'phoneNo':
      if (!value) return 'Please enter a phone number.';
      if (!isValidPhone(value)) return 'Enter a valid phone number (e.g. 08012345678 or +447911123456).';
      return '';

    case 'department':
      if (!value) return 'Please select a department.';
      return '';

    case 'email':
      // Optional — only validate format when populated
      if (value && !isValidEmail(value)) {
        return 'Enter a valid email address or leave this field empty.';
      }
      return '';

    case 'otherNames':
      // Optional — always valid
      return '';

    default:
      return '';
  }
}

/** Validate one field and update DOM error state. Returns true if valid. */
function validateField(id) {
  const error = getFieldError(id);
  if (error) {
    setFieldError(id, error);
    return false;
  } else {
    clearFieldError(id);
    return true;
  }
}

/** Validate all fields. Returns true if the form is entirely valid. */
function validateAll() {
  let firstInvalidEl = null;
  let allValid = true;

  ALL_FIELDS.forEach(id => {
    const valid = validateField(id);
    if (!valid && !firstInvalidEl) {
      firstInvalidEl = document.getElementById(id);
    }
    if (!valid) allValid = false;
  });

  if (firstInvalidEl) {
    firstInvalidEl.focus();
    firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return allValid;
}

/* ──────────────────────────────────────────────────────────────────
   ERROR DOM HELPERS
────────────────────────────────────────────────────────────────── */
function setFieldError(id, message) {
  const input = document.getElementById(id);
  const errEl = document.getElementById(id + '-error');
  if (input) {
    input.classList.add('rs-input-error');
    input.setAttribute('aria-invalid', 'true');
  }
  if (errEl) {
    errEl.textContent = message;
    errEl.classList.add('rs-visible');
  }
}

function clearFieldError(id) {
  const input = document.getElementById(id);
  const errEl = document.getElementById(id + '-error');
  if (input) {
    input.classList.remove('rs-input-error');
    input.removeAttribute('aria-invalid');
  }
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.remove('rs-visible');
  }
}

function clearAllErrors() {
  ALL_FIELDS.forEach(id => clearFieldError(id));
}

/* ──────────────────────────────────────────────────────────────────
   COMPLETION INDICATOR
────────────────────────────────────────────────────────────────── */
function updateCompletion() {
  syncState();
  const completed = REQUIRED_FIELDS.filter(id => getFieldError(id) === '' && formState[id] !== '').length;
  const total     = REQUIRED_FIELDS.length; // 6
  const pct       = Math.round((completed / total) * 100);

  const circle  = document.getElementById('completionCircle');
  const pctEl   = document.getElementById('completionPct');
  const countEl = document.getElementById('completionCount');

  if (circle)  circle.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
  if (pctEl)   pctEl.textContent  = pct + '%';
  if (countEl) countEl.textContent = `${completed} of ${total} complete`;

  // Shift stroke colour to green at 100%
  if (circle) {
    circle.setAttribute('stroke', pct === 100 ? '#10B981' : '#D4B15A');
  }
}

/* ──────────────────────────────────────────────────────────────────
   FORM SUBMISSION
────────────────────────────────────────────────────────────────── */
function bindFormSubmit() {
  const form = document.getElementById('staffRegForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault(); // Prevent any browser default / page reload

    syncState();

    const isValid = validateAll();
    if (!isValid) return; // Stop — errors are shown inline

    // Build the frontend-only record object (strings preserved as-is)
    const staffRecord = {
      staffNo:       formState.staffNo,
      firstName:     formState.firstName,
      lastName:      formState.lastName,
      otherNames:    formState.otherNames,
      biometricNo:   formState.biometricNo,
      email:         formState.email,
      phoneNo:       formState.phoneNo,
      department:    formState.department,
    };

    // Persist to mock staff store so it appears across all pages
    try {
      const stored = localStorage.getItem('ps_mock_staff_v1');
      let staffList = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(staffList)) staffList = [];
      const existsIdx = staffList.findIndex(s => s.staffNo && s.staffNo.toLowerCase() === staffRecord.staffNo.toLowerCase());
      const newStaff = {
        staffNo: staffRecord.staffNo,
        firstName: staffRecord.firstName,
        lastName: staffRecord.lastName,
        otherNames: staffRecord.otherNames || '',
        biometricEnrollmentNo: staffRecord.biometricNo,
        email: staffRecord.email || '',
        phoneNo: staffRecord.phoneNo,
        department: staffRecord.department,
        role: staffRecord.department === 'Teaching' ? 'Subject Teacher' : 'Administrative Staff',
        joinedDate: new Date().toISOString().split('T')[0],
        gender: 'Male',
        qualification: 'B.Sc Education',
        stateOfOrigin: 'Lagos State',
        address: 'Phronesis Sunesis Campus',
        status: 'Active'
      };
      if (existsIdx >= 0) {
        staffList[existsIdx] = newStaff;
      } else {
        staffList.unshift(newStaff);
      }
      localStorage.setItem('ps_mock_staff_v1', JSON.stringify(staffList));
    } catch (e) {
      console.warn('Could not persist staff to localStorage', e);
    }

    openPreview(staffRecord);
  });
}

/* ──────────────────────────────────────────────────────────────────
   PREVIEW MODAL
────────────────────────────────────────────────────────────────── */
function buildFullName(rec) {
  const parts = [rec.firstName, rec.otherNames, rec.lastName].filter(Boolean);
  return parts.join(' ');
}

function openPreview(rec) {
  const fullName = buildFullName(rec);

  // Avatar: initials from first + last
  const initials = ((rec.firstName[0] || '') + (rec.lastName[0] || '')).toUpperCase();

  // Safely set text content — no innerHTML with user data
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text || 'Not provided';
  };

  const el = id => document.getElementById(id);

  if (el('previewAvatar'))   el('previewAvatar').textContent   = initials || 'ST';
  if (el('previewFullName')) el('previewFullName').textContent = fullName;

  // Department badge
  const deptEl = el('previewDeptBadge');
  if (deptEl) deptEl.textContent = rec.department;

  setText('pvStaffNo',    rec.staffNo);
  setText('pvBiometricNo', rec.biometricNo);
  setText('pvDepartment',  rec.department);
  setText('pvPhoneNo',     rec.phoneNo);
  setText('pvEmail',       rec.email || 'Not provided');

  // Show the overlay
  const overlay = document.getElementById('previewOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    // Focus the close button for accessibility
    setTimeout(() => {
      const closeBtn = document.getElementById('previewCloseBtn');
      if (closeBtn) closeBtn.focus();
    }, 50);
  }
}

function closePreview() {
  const overlay = document.getElementById('previewOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
  // Return focus to submit button
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.focus();
}

function bindPreviewModal() {
  const overlay     = document.getElementById('previewOverlay');
  const closeBtn    = document.getElementById('previewCloseBtn');
  const backBtn     = document.getElementById('previewBackBtn');
  const doneBtn     = document.getElementById('previewDoneBtn');

  if (closeBtn) closeBtn.addEventListener('click', closePreview);
  if (backBtn)  backBtn.addEventListener('click', closePreview);

  // Done: close preview AND reset form
  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      closePreview();
      performReset();
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const previewVisible = overlay && !overlay.classList.contains('hidden');
      const clearVisible   = !document.getElementById('clearConfirmOverlay').classList.contains('hidden');
      if (previewVisible) { e.preventDefault(); closePreview(); }
      if (clearVisible)   { e.preventDefault(); closeClearDialog(); }
    }
  });

  // Close when clicking the backdrop (outside the modal box)
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closePreview();
    });
  }
}

/* ──────────────────────────────────────────────────────────────────
   CLEAR FORM
────────────────────────────────────────────────────────────────── */
function isFormEmpty() {
  syncState();
  return ALL_FIELDS.every(id => formState[id] === '');
}

function performReset() {
  // Reset all native input/select values
  ALL_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else {
        el.value = '';
      }
      formState[id] = '';
    }
  });

  clearAllErrors();
  updateCompletion();
  closeClearDialog();

  // Return focus to the first field
  const firstInput = document.getElementById('staffNo');
  if (firstInput) firstInput.focus();
}

function openClearDialog() {
  const overlay = document.getElementById('clearConfirmOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      const cancelBtn = document.getElementById('clearCancelBtn');
      if (cancelBtn) cancelBtn.focus();
    }, 50);
  }
}

function closeClearDialog() {
  const overlay = document.getElementById('clearConfirmOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function bindClearForm() {
  const clearBtn      = document.getElementById('clearFormBtn');
  const cancelBtn     = document.getElementById('clearCancelBtn');
  const confirmBtn    = document.getElementById('clearConfirmBtn');
  const clearOverlay  = document.getElementById('clearConfirmOverlay');

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (isFormEmpty()) {
        // Nothing entered — reset without dialog
        performReset();
      } else {
        openClearDialog();
      }
    });
  }

  if (cancelBtn)  cancelBtn.addEventListener('click', closeClearDialog);
  if (confirmBtn) confirmBtn.addEventListener('click', performReset);

  // Close dialog on backdrop click
  if (clearOverlay) {
    clearOverlay.addEventListener('click', e => {
      if (e.target === clearOverlay) closeClearDialog();
    });
  }
}
