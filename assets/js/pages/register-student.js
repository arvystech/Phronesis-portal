// admin/js/pages/register-student.js
import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { studentsAPI } from '../api.js';

let step = 1;
const isMobile = () => window.innerWidth < 768;

const formState = {
  fullName: '', dateOfBirth: '', gender: '', bloodGroup: '', religion: '',
  nationality: 'Nigerian', stateOfOrigin: '', localGovernment: '', motherTongue: '',
  studentPhone: '', studentEmail: '', homeAddress: '', class: '', previousSchool: '',
  healthCondition: '',
  parentName: '', parentOccupation: '', parentPhone: '', parentEmail: '',
  hobbies: '', specialInterests: '', emergencyContact: '', emergencyPhone: '',
  guardianName: '', guardianRelationship: '', guardianPhone: '',
  registrationFee: '15000', amountPaid: '', balance: '15000',
  paymentMethod: 'Cash', receiptNo: '', registeredBy: '',
  academicSession: '2025/2026',
};

const fileState = {
  studentPassport: null,
  parentPassport: null,
  guardianPassport: null,
};

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('register', 'Register Student');

  await requireAuth((admin) => {
    formState.registeredBy = admin?.name || 'Admin';
    initRegisterStudent();
  });
});

function initRegisterStudent() {
  bindFormInputs();
  bindFileInputs();
  bindStepNavigation();
  updateStepUI();

  window.addEventListener('resize', () => {
    updateStepUI();
  });

  const form = document.getElementById('studentRegForm');
  form.addEventListener('submit', handleFormSubmit);
}

function bindFormInputs() {
  const inputs = document.querySelectorAll('[data-bind]');
  inputs.forEach((input) => {
    const key = input.getAttribute('data-bind');

    input.addEventListener('input', (e) => {
      formState[key] = e.target.value;

      if (key === 'amountPaid' || key === 'registrationFee') {
        const fee = parseFloat(formState.registrationFee) || 0;
        const paid = parseFloat(formState.amountPaid) || 0;
        formState.balance = Math.max(fee - paid, 0).toString();

        const balanceEl = document.getElementById('balanceInput');
        if (balanceEl) {
          balanceEl.value = '₦' + Number(formState.balance).toLocaleString();
        }
      }

      updateSummary();
    });

    input.addEventListener('change', (e) => {
      formState[key] = e.target.value;
      updateSummary();
    });
  });
}

function updateSummary() {
  const sStudent = document.getElementById('sumStudent');
  const sClass = document.getElementById('sumClass');
  const sParent = document.getElementById('sumParent');
  const sContact = document.getElementById('sumContact');

  if (sStudent) sStudent.textContent = formState.fullName || '—';
  if (sClass) sClass.textContent = formState.class || '—';
  if (sParent) sParent.textContent = formState.parentName || '—';
  if (sContact) sContact.textContent = formState.parentPhone || '—';
}

function bindFileInputs() {
  const bindFile = (inputId, previewId, stateKey) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        fileState[stateKey] = file;
        const url = URL.createObjectURL(file);
        preview.src = url;

        // Also update print preview images if present
        if (stateKey === 'studentPassport') {
          const pStudent = document.getElementById('printStudentPassport');
          if (pStudent) pStudent.src = url;
        } else if (stateKey === 'guardianPassport') {
          const pGuardian = document.getElementById('printGuardianPassport');
          if (pGuardian) pGuardian.src = url;
        }
      }
    });
  };

  bindFile('studentPassportInput', 'studentPassportPreview', 'studentPassport');
  bindFile('parentPassportInput', 'parentPassportPreview', 'parentPassport');
  bindFile('guardianPassportInput', 'guardianPassportPreview', 'guardianPassport');
}

function bindStepNavigation() {
  const nextBtn = document.getElementById('mobileNextBtn');
  const prevBtn = document.getElementById('mobilePrevBtn');
  const submitBtn = document.getElementById('mobileSubmitBtn');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (canGoNext()) {
        step = Math.min(step + 1, 5);
        updateStepUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.toast.error('Please fill required fields first.');
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      step = Math.max(step - 1, 1);
      updateStepUI();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      document.getElementById('studentRegForm').requestSubmit();
    });
  }
}

function canGoNext() {
  if (step === 1) return formState.fullName && formState.dateOfBirth && formState.gender && formState.class;
  if (step === 2) return formState.parentName && formState.parentPhone && formState.emergencyContact && formState.emergencyPhone;
  return true;
}

function updateStepUI() {
  const mobile = isMobile();
  const mobileControls = document.getElementById('mobileControls');
  const mobileProgress = document.getElementById('mobileProgressBar');
  const brandingHeader = document.getElementById('brandingHeader');

  if (mobile) {
    if (mobileControls) mobileControls.classList.remove('hidden');
    if (mobileProgress) mobileProgress.classList.remove('hidden');

    // Step counter
    const stepText = document.getElementById('stepCounterText');
    const stepPct = document.getElementById('stepPercentText');
    const stepBar = document.getElementById('stepProgressFill');
    if (stepText) stepText.textContent = `Step ${step} of 5`;
    if (stepPct) stepPct.textContent = `${Math.round((step / 5) * 100)}% Complete`;
    if (stepBar) stepBar.style.width = `${(step / 5) * 100}%`;

    // Only show branding header on step 1 on mobile
    if (brandingHeader) {
      if (step === 1) brandingHeader.classList.remove('hidden');
      else brandingHeader.classList.add('hidden');
    }

    // Toggle sections
    for (let s = 1; s <= 5; s++) {
      const sec = document.getElementById(`section${s}`);
      if (sec) {
        if (s === step) sec.classList.remove('hidden');
        else sec.classList.add('hidden');
      }
    }

    // Toggle back / next / submit buttons
    const prevBtn = document.getElementById('mobilePrevBtn');
    const nextBtn = document.getElementById('mobileNextBtn');
    const submitBtn = document.getElementById('mobileSubmitBtn');

    if (prevBtn) prevBtn.classList.toggle('hidden', step === 1);
    if (nextBtn) nextBtn.classList.toggle('hidden', step === 5);
    if (submitBtn) submitBtn.classList.toggle('hidden', step !== 5);
  } else {
    if (mobileControls) mobileControls.classList.add('hidden');
    if (mobileProgress) mobileProgress.classList.add('hidden');
    if (brandingHeader) brandingHeader.classList.remove('hidden');

    // Show all sections on desktop
    for (let s = 1; s <= 5; s++) {
      const sec = document.getElementById(`section${s}`);
      if (sec) sec.classList.remove('hidden');
    }
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();

  if (!formState.fullName || !formState.dateOfBirth || !formState.gender || !formState.class || !formState.emergencyContact) {
    window.toast.error('Please fill in all required fields.');
    return;
  }

  const submitButtons = document.querySelectorAll('[type="submit"], #mobileSubmitBtn');
  submitButtons.forEach((btn) => (btn.disabled = true));

  try {
    const formData = new FormData();

    Object.keys(formState).forEach((key) => {
      formData.append(key, formState[key] || '');
    });

    // Calculate age
    const dob = new Date(formState.dateOfBirth);
    const age = Math.floor((new Date() - dob) / (365.25 * 24 * 3600000));
    formData.append('age', age || 0);

    // Files
    if (fileState.studentPassport) formData.append('passport', fileState.studentPassport);
    if (fileState.parentPassport) formData.append('parent_photo', fileState.parentPassport);
    if (fileState.guardianPassport) formData.append('guardian_photo', fileState.guardianPassport);

    const res = await studentsAPI.create(formData);
    const admNo = res.data?.data?.admissionNumber || res.data?.data?.registrationNumber || '';
    window.toast.success(`Student registered! Admission No: ${admNo}`);

    setTimeout(() => {
      window.location.href = 'students.html';
    }, 600);
  } catch (err) {
    console.error('Registration failed:', err);
    window.toast.error(err.response?.data?.message || 'Registration failed.');
  } finally {
    submitButtons.forEach((btn) => (btn.disabled = false));
  }
}
