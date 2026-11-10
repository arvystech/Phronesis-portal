
// assets/js/pages/register-staff.js
// Staff Registration Page — Connected to Live Backend API: POST /admin/add-staff

import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { staffAPI } from '../api.js';

/* ──────────────────────────────────────────────────────────────────
   FORM STATE
   Holds trimmed values used for validation and submission.
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
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

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
   INPUT LISTENERS (real-time validation on blur; clear error on input)
────────────────────────────────────────────────────────────────── */
function bindInputListeners() {
  ALL_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Sync state on every keystroke
    el.addEventListener('input', () => {
      syncState();
      clearFieldError(id);
      updateCompletion();
    });

    // Validate on blur for required fields
    el.addEventListener('blur', () => {
      syncState();
      validateField(id);
      updateCompletion();
    });

    // Select elements also handle 'change'
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

/** Email format – RFC compliant surface check. */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Phone: allow Nigerian (+234 / 070 / 080 / 090 / 091 + 8 digits) and
 * international formats (+country-code ...). Min 7 digits total.
 * Preserves leading + and formatting characters.
 */
function isValidPhone(value) {
  const stripped = value.replace(/[\s\-().]/g, '');
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
      if (!isValidPhone(value)) return 'Enter a valid phone number (e.g. +2348033334455 or 08012345678).';
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
  const total = REQUIRED_FIELDS.length; // 6
  const pct = Math.round((completed / total) * 100);

  const circle = document.getElementById('completionCircle');
  const pctEl = document.getElementById('completionPct');
  const countEl = document.getElementById('completionCount');

  if (circle) circle.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
  if (pctEl) pctEl.textContent = pct + '%';
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

  form.addEventListener('submit', async e => {
    e.preventDefault();

    syncState();

    const isValid = validateAll();
    if (!isValid) return;

    // Normalize department to exact backend accepted enum values ("Teaching" or "Non-Teaching")
    let department = formState.department;
    if (department.toLowerCase().includes('non')) {
      department = 'Non-Teaching';
    } else {
      department = 'Teaching';
    }

    // Construct the backend payload structure
    const payload = {
      staff_no: formState.staffNo,
      first_name: formState.firstName,
      last_name: formState.lastName,
      other_names: formState.otherNames ? formState.otherNames : null,
      biometric_enrollment_no: formState.biometricNo,
      phone: formState.phoneNo,
      department: department,
      email: formState.email ? formState.email : null,
    };

    const submitBtn = document.getElementById('submitBtn');
    let originalBtnHTML = '';
    if (submitBtn) {
      originalBtnHTML = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" aria-hidden="true"></span>
        Registering Staff…
      `;
    }

    try {
      // Submit to real backend endpoint POST /admin/add-staff
      const result = await staffAPI.create(payload);

      // Notification
      const successMessage = result?.data?.message || 'Staff member registered successfully!';
      if (window.toast?.success) {
        window.toast.success(successMessage);
      }

      // Record for preview
      const previewRecord = {
        staffNo: payload.staff_no,
        firstName: payload.first_name,
        lastName: payload.last_name,
        otherNames: payload.other_names || '',
        biometricNo: payload.biometric_enrollment_no,
        phoneNo: payload.phone,
        department: payload.department,
        email: payload.email || '',
      };

      // Reset form fields
      performReset();

      // Invalidate or refresh local staff cache so staff listing reflects database immediately
      try {
        localStorage.removeItem('ps_live_staff_cache');
      } catch (_) { }

      // Open preview confirmation dialog
      openPreview(previewRecord);

    } catch (err) {
      console.error('Staff registration error:', err);

      const status = err.status || err.response?.status;
      const data = err.response?.data || err.data;
      const errorMsg = data?.message || data?.error || err.message || 'Failed to register staff.';

      // Map backend validation errors to form fields if present
      if (data?.errors && typeof data.errors === 'object') {
        const errors = data.errors;
        if (errors.staff_no) setFieldError('staffNo', errors.staff_no);
        if (errors.first_name) setFieldError('firstName', errors.first_name);
        if (errors.last_name) setFieldError('lastName', errors.last_name);
        if (errors.biometric_enrollment_no) setFieldError('biometricNo', errors.biometric_enrollment_no);
        if (errors.phone) setFieldError('phoneNo', errors.phone);
        if (errors.department) setFieldError('department', errors.department);
        if (errors.email) setFieldError('email', errors.email);
      }

      // Handle 409 Conflict (duplicate staff number, biometric, or email)
      if (status === 409) {
        const lowerMsg = errorMsg.toLowerCase();
        if (lowerMsg.includes('staff number') || lowerMsg.includes('staff_no')) {
          setFieldError('staffNo', errorMsg);
        } else if (lowerMsg.includes('biometric')) {
          setFieldError('biometricNo', errorMsg);
        } else if (lowerMsg.includes('email')) {
          setFieldError('email', errorMsg);
        }
      }

      // Handle 401 Unauthorized / Session expired
      if (status === 401) {
        if (window.toast?.error) {
          window.toast.error('Session expired. Please sign in again.');
        }
        setTimeout(() => {
          window.location.replace('/admin/login');
        }, 1200);
        return;
      }

      // Display user-friendly notification
      if (window.toast?.error) {
        window.toast.error(errorMsg);
      } else {
        alert(errorMsg);
      }

    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
      }
    }
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

  // Safely set text content
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text || 'Not provided';
  };

  const el = id => document.getElementById(id);

  if (el('previewAvatar')) el('previewAvatar').textContent = initials || 'ST';
  if (el('previewFullName')) el('previewFullName').textContent = fullName;

  // Department badge
  const deptEl = el('previewDeptBadge');
  if (deptEl) deptEl.textContent = rec.department;

  setText('pvStaffNo', rec.staffNo);
  setText('pvBiometricNo', rec.biometricNo);
  setText('pvDepartment', rec.department);
  setText('pvPhoneNo', rec.phoneNo);
  setText('pvEmail', rec.email || 'Not provided');

  // Show the overlay
  const overlay = document.getElementById('previewOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
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
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.focus();
}

function bindPreviewModal() {
  const overlay = document.getElementById('previewOverlay');
  const closeBtn = document.getElementById('previewCloseBtn');
  const backBtn = document.getElementById('previewBackBtn');
  const doneBtn = document.getElementById('previewDoneBtn');

  if (closeBtn) closeBtn.addEventListener('click', closePreview);
  if (backBtn) backBtn.addEventListener('click', closePreview);

  // Done button: close preview
  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      closePreview();
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const previewVisible = overlay && !overlay.classList.contains('hidden');
      const clearVisible = !document.getElementById('clearConfirmOverlay')?.classList.contains('hidden');
      if (previewVisible) { e.preventDefault(); closePreview(); }
      if (clearVisible) { e.preventDefault(); closeClearDialog(); }
    }
  });

  // Close when clicking the backdrop
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
  const clearBtn = document.getElementById('clearFormBtn');
  const cancelBtn = document.getElementById('clearCancelBtn');
  const confirmBtn = document.getElementById('clearConfirmBtn');
  const clearOverlay = document.getElementById('clearConfirmOverlay');

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (isFormEmpty()) {
        performReset();
      } else {
        openClearDialog();
      }
    });
  }

  if (cancelBtn) cancelBtn.addEventListener('click', closeClearDialog);
  if (confirmBtn) confirmBtn.addEventListener('click', performReset);

  if (clearOverlay) {
    clearOverlay.addEventListener('click', e => {
      if (e.target === clearOverlay) closeClearDialog();
    });
  }
}
