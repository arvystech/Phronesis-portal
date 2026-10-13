// admin/js/pages/apply-staff.js
import { staffAPI } from '../api.js';

let step = 1;
const isMobile = () => window.innerWidth < 768;

const formState = {
  fullname: '', dob: '', gender: '', nationality: 'Nigerian',
  stateOfOrigin: '', maritalStatus: '', address: '', phone: '', email: '',
  positionApplied: '', employmentType: 'Full-time', roleCategory: 'Teaching',
  department: '',
  education: [{ highest_qualification: '', institution: '', course: '', graduation_year: '', certifications: '', trcn: '' }],
  yearsOfExperience: '0',
  experience: [{ employer: '', position: '', responsibilities: '', reason: '' }],
  subjects: '', computerSkills: '', communicationSkills: '', adminSkills: '', languages: '',
  referee1_name: '', referee1_occupation: '', referee1_relationship: '', referee1_phone: '', referee1_email: '',
  referee2_name: '', referee2_occupation: '', referee2_relationship: '', referee2_phone: '', referee2_email: '',
  q_why: '', q_value: '', q_philosophy: '',
  declarationSigned: false,
  declarationName: '',
};

const fileState = {
  passport: null,
  cv: null,
  certificate: null,
  means_of_id: null,
  recommendation: null,
};

document.addEventListener('DOMContentLoaded', () => {
  initApplyStaff();
});

function initApplyStaff() {
  bindFormInputs();
  bindDynamicEducation();
  bindDynamicExperience();
  bindFileInputs();
  bindStepNavigation();
  updateStepUI();

  window.addEventListener('resize', updateStepUI);

  const form = document.getElementById('staffAppForm');
  form.addEventListener('submit', handleSubmit);
}

function bindFormInputs() {
  const inputs = document.querySelectorAll('[data-bind]');
  inputs.forEach((input) => {
    const key = input.getAttribute('data-bind');
    const update = (e) => {
      if (input.type === 'checkbox') {
        formState[key] = e.target.checked;
      } else {
        formState[key] = e.target.value;
      }
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });
}

function bindFileInputs() {
  const setupFile = (inputId, stateKey, previewId) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        fileState[stateKey] = file;
        if (previewId) {
          const prevEl = document.getElementById(previewId);
          if (prevEl) prevEl.src = URL.createObjectURL(file);
        }
      }
    });
  };

  setupFile('staffPassportInput', 'passport', 'staffPassportPreview');
  setupFile('staffCvInput', 'cv');
  setupFile('staffCertInput', 'certificate');
  setupFile('staffIdInput', 'means_of_id');
  setupFile('staffRecInput', 'recommendation');
}

function bindDynamicEducation() {
  renderEducationRows();
  const addBtn = document.getElementById('addEduBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      formState.education.push({ highest_qualification: '', institution: '', course: '', graduation_year: '', certifications: '', trcn: '' });
      renderEducationRows();
    });
  }
}

function renderEducationRows() {
  const container = document.getElementById('educationContainer');
  if (!container) return;

  container.innerHTML = formState.education.map((edu, idx) => `
    <div class="bg-warm-white p-4 rounded-xl border border-border relative space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-xs font-bold text-royal uppercase tracking-wider">Qualification #${idx + 1}</span>
        ${formState.education.length > 1 ? `
          <button type="button" onclick="window.removeEduRow(${idx})" class="text-red-500 hover:text-red-700 text-xs font-bold">✕ Remove</button>
        ` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="form-label text-[10px]">Highest Qualification</label>
          <input class="form-input text-xs" value="${edu.highest_qualification || ''}" oninput="window.updateEduField(${idx}, 'highest_qualification', this.value)" placeholder="e.g. B.Ed, B.Sc, NCE" />
        </div>
        <div>
          <label class="form-label text-[10px]">Course / Discipline</label>
          <input class="form-input text-xs" value="${edu.course || ''}" oninput="window.updateEduField(${idx}, 'course', this.value)" placeholder="e.g. English Education" />
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="form-label text-[10px]">Institution</label>
          <input class="form-input text-xs" value="${edu.institution || ''}" oninput="window.updateEduField(${idx}, 'institution', this.value)" placeholder="University / College" />
        </div>
        <div>
          <label class="form-label text-[10px]">Graduation Year</label>
          <input class="form-input text-xs" value="${edu.graduation_year || ''}" oninput="window.updateEduField(${idx}, 'graduation_year', this.value)" placeholder="e.g. 2021" />
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="form-label text-[10px]">Additional Certifications</label>
          <input class="form-input text-xs" value="${edu.certifications || ''}" oninput="window.updateEduField(${idx}, 'certifications', this.value)" placeholder="Optional" />
        </div>
        <div>
          <label class="form-label text-[10px]">TRCN Registration Number</label>
          <input class="form-input text-xs" value="${edu.trcn || ''}" oninput="window.updateEduField(${idx}, 'trcn', this.value)" placeholder="If registered" />
        </div>
      </div>
    </div>
  `).join('');
}

window.updateEduField = (idx, field, val) => {
  formState.education[idx][field] = val;
};

window.removeEduRow = (idx) => {
  formState.education.splice(idx, 1);
  renderEducationRows();
};

function bindDynamicExperience() {
  renderExperienceRows();
  const addBtn = document.getElementById('addExpBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      formState.experience.push({ employer: '', position: '', responsibilities: '', reason: '' });
      renderExperienceRows();
    });
  }
}

function renderExperienceRows() {
  const container = document.getElementById('experienceContainer');
  if (!container) return;

  container.innerHTML = formState.experience.map((exp, idx) => `
    <div class="bg-warm-white p-4 rounded-xl border border-border relative space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-xs font-bold text-royal uppercase tracking-wider">Employment #${idx + 1}</span>
        ${formState.experience.length > 1 ? `
          <button type="button" onclick="window.removeExpRow(${idx})" class="text-red-500 hover:text-red-700 text-xs font-bold">✕ Remove</button>
        ` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="form-label text-[10px]">Employer / School Name</label>
          <input class="form-input text-xs" value="${exp.employer || ''}" oninput="window.updateExpField(${idx}, 'employer', this.value)" placeholder="Name of school/org" />
        </div>
        <div>
          <label class="form-label text-[10px]">Job Title / Position</label>
          <input class="form-input text-xs" value="${exp.position || ''}" oninput="window.updateExpField(${idx}, 'position', this.value)" placeholder="e.g. Science Teacher" />
        </div>
      </div>
      <div>
        <label class="form-label text-[10px]">Key Responsibilities</label>
        <textarea rows="2" class="form-input text-xs" oninput="window.updateExpField(${idx}, 'responsibilities', this.value)" placeholder="Main duties...">${exp.responsibilities || ''}</textarea>
      </div>
      <div>
        <label class="form-label text-[10px]">Reason for Leaving</label>
        <input class="form-input text-xs" value="${exp.reason || ''}" oninput="window.updateExpField(${idx}, 'reason', this.value)" placeholder="e.g. Relocation" />
      </div>
    </div>
  `).join('');
}

window.updateExpField = (idx, field, val) => {
  formState.experience[idx][field] = val;
};

window.removeExpRow = (idx) => {
  formState.experience.splice(idx, 1);
  renderExperienceRows();
};

function bindStepNavigation() {
  const nextBtn = document.getElementById('applyNextBtn');
  const prevBtn = document.getElementById('applyPrevBtn');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (canGoNext()) {
        step = Math.min(step + 1, 4);
        updateStepUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.toast.error('Please complete all required fields in this step.');
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
}

function canGoNext() {
  if (step === 1) return formState.fullname && formState.dob && formState.gender && formState.phone && formState.email && formState.positionApplied;
  return true;
}

function updateStepUI() {
  const mobile = isMobile();
  const mobileProgress = document.getElementById('applyProgressBar');
  const mobileControls = document.getElementById('applyControls');

  if (mobile) {
    if (mobileProgress) mobileProgress.classList.remove('hidden');
    if (mobileControls) mobileControls.classList.remove('hidden');

    const stepText = document.getElementById('applyStepCounter');
    const stepPct = document.getElementById('applyStepPercent');
    const stepBar = document.getElementById('applyStepBar');

    if (stepText) stepText.textContent = `Step ${step} of 4`;
    if (stepPct) stepPct.textContent = `${Math.round((step / 4) * 100)}% Complete`;
    if (stepBar) stepBar.style.width = `${(step / 4) * 100}%`;

    // Toggle step sections on mobile
    const s1 = document.getElementById('applyStep1Section');
    const s2 = document.getElementById('applyStep2Section');
    const s3 = document.getElementById('applyStep3Section');
    const s4 = document.getElementById('applyStep4Section');

    if (s1) s1.classList.toggle('hidden', step !== 1);
    if (s2) s2.classList.toggle('hidden', step !== 2);
    if (s3) s3.classList.toggle('hidden', step !== 3);
    if (s4) s4.classList.toggle('hidden', step !== 4);

    const prevBtn = document.getElementById('applyPrevBtn');
    const nextBtn = document.getElementById('applyNextBtn');
    const submitBtn = document.getElementById('applySubmitBtn');

    if (prevBtn) prevBtn.classList.toggle('hidden', step === 1);
    if (nextBtn) nextBtn.classList.toggle('hidden', step === 4);
    if (submitBtn) submitBtn.classList.toggle('hidden', step !== 4);
  } else {
    if (mobileProgress) mobileProgress.classList.add('hidden');
    if (mobileControls) mobileControls.classList.add('hidden');

    document.querySelectorAll('.apply-step-section').forEach(sec => sec.classList.remove('hidden'));
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  if (!formState.declarationSigned || !formState.declarationName) {
    window.toast.error('You must sign the declaration.');
    return;
  }

  if (!fileState.passport || !fileState.cv || !fileState.certificate || !fileState.means_of_id) {
    window.toast.error('Please upload all required documents.');
    return;
  }

  const submitButtons = document.querySelectorAll('#applySubmitBtn, #desktopSubmitBtn');
  submitButtons.forEach(btn => btn.disabled = true);

  try {
    const formData = new FormData();

    // Standard fields
    Object.keys(formState).forEach(key => {
      if (key !== 'education' && key !== 'experience' && !key.startsWith('referee') && !key.startsWith('q_') && !key.startsWith('subjects')) {
        formData.append(key, formState[key] || '');
      }
    });

    // JSON fields
    formData.append('education', JSON.stringify(formState.education));
    formData.append('experience', JSON.stringify(formState.experience));
    formData.append('skills', JSON.stringify({
      subjects: formState.subjects,
      computer: formState.computerSkills,
      communication: formState.communicationSkills,
      admin: formState.adminSkills,
      languages: formState.languages,
    }));
    formData.append('referees', JSON.stringify([
      { name: formState.referee1_name, occupation: formState.referee1_occupation, relationship: formState.referee1_relationship, phone: formState.referee1_phone, email: formState.referee1_email },
      { name: formState.referee2_name, occupation: formState.referee2_occupation, relationship: formState.referee2_relationship, phone: formState.referee2_phone, email: formState.referee2_email },
    ]));
    formData.append('questions', JSON.stringify({
      why: formState.q_why,
      value: formState.q_value,
      philosophy: formState.q_philosophy,
    }));

    // Files
    if (fileState.passport) formData.append('passport', fileState.passport);
    if (fileState.cv) formData.append('cv', fileState.cv);
    if (fileState.certificate) formData.append('certificate', fileState.certificate);
    if (fileState.means_of_id) formData.append('means_of_id', fileState.means_of_id);
    if (fileState.recommendation) formData.append('recommendation', fileState.recommendation);

    await staffAPI.submitApplication(formData);

    // Show success view
    document.getElementById('staffAppFormContainer').classList.add('hidden');
    document.getElementById('applySuccessContainer').classList.remove('hidden');
    document.getElementById('successCandidateName').textContent = formState.fullname;
    document.getElementById('successPosition').textContent = formState.positionApplied;

    window.toast.success('Application submitted successfully!');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error('Application error:', err);
    window.toast.error(err.response?.data?.message || 'Failed to submit application.');
  } finally {
    submitButtons.forEach(btn => btn.disabled = false);
  }
}
