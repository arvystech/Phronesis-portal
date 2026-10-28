// admin/js/pages/staff-application-detail.js
import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { staffAPI } from '../api.js';

let appId = null;
let app = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('staff', 'Staff Application Detail');

  const params = new URLSearchParams(window.location.search);
  appId = params.get('id');
  if (!appId) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    const nonIdNames = ['staff-applications', 'staff-application-detail.html', 'staff-application-detail'];
    if (last && !nonIdNames.includes(last.toLowerCase())) {
      appId = decodeURIComponent(last);
    }
  }

  if (!appId) {
    appId = 'app_001';
  }

  await requireAuth(() => {
    fetchApplication();
  });
});

async function fetchApplication() {
  const loadingEl = document.getElementById('appDetailLoading');
  const contentEl = document.getElementById('appDetailContent');

  try {
    loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');

    const res = await staffAPI.getApplication(appId);
    app = res.data?.data;

    if (!app) {
      window.toast.error('Application not found');
      window.location.href = '/admin/staff-applications';
      return;
    }

    renderApplication(app);
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    window.toast.error('Failed to load application details');
    window.location.href = '/admin/staff-applications';
  }
}

function safeParse(str) {
  if (!str) return null;
  try { return typeof str === 'object' ? str : JSON.parse(str); } catch { return null; }
}

function renderApplication(app) {
  // Action buttons
  const actionsContainer = document.getElementById('headerActions');
  if (app.status === 'Pending') {
    actionsContainer.innerHTML = `
      <button onclick="window.updateAppStatus('Rejected')" class="btn-secondary text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300">
        ✗ Reject
      </button>
      <button onclick="window.updateAppStatus('Approved')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all">
        ✓ Approve & Hire
      </button>
    `;
  } else {
    actionsContainer.innerHTML = '';
  }

  // Status badge
  const statusBadge = document.getElementById('appStatusBadge');
  statusBadge.className = `px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
    app.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
    app.status === 'Rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
    'bg-amber-100 text-amber-700 border border-amber-200'
  }`;
  statusBadge.textContent = app.status || 'Pending';

  // Banner details
  const avatarEl = document.getElementById('appAvatar');
  if (app.passport_path) {
    avatarEl.innerHTML = `<img src="${app.passport_path}" class="w-full h-full object-cover rounded-full" />`;
  } else {
    avatarEl.innerHTML = `<div class="w-full h-full flex items-center justify-center text-3xl text-gold">${app.fullname ? app.fullname[0] : 'S'}</div>`;
  }

  document.getElementById('appName').textContent = app.fullname || '—';
  document.getElementById('appPosition').textContent = app.position_applied || '—';
  document.getElementById('appCategory').textContent = `${app.role_category || ''} • ${app.employment_type || ''}`;

  document.getElementById('appEmail').textContent = app.email || '—';
  document.getElementById('appPhone').textContent = app.phone || '—';
  document.getElementById('appGender').textContent = app.gender || '—';
  document.getElementById('appDob').textContent = app.dob ? new Date(app.dob).toLocaleDateString() : 'N/A';
  document.getElementById('appAddress').textContent = app.address || '—';

  // Work Experience
  document.getElementById('appExpYears').textContent = `${app.years_of_experience || 0} Years Total`;
  const experience = safeParse(app.experience_json) || [];
  const expContainer = document.getElementById('experienceList');
  if (experience.length === 0) {
    expContainer.innerHTML = `<p class="text-sm text-text-soft">No experience records found.</p>`;
  } else {
    expContainer.innerHTML = experience.map(exp => `
      <div class="border-l-2 border-royal/20 pl-4 py-1">
        <h3 class="font-bold text-text-dark">${exp.position || 'Position'}</h3>
        <p class="text-sm text-royal font-medium">${exp.employer || 'Employer'}</p>
        <p class="text-xs text-text-soft mt-2 leading-relaxed">${exp.responsibilities || ''}</p>
        ${exp.reason ? `<p class="text-[10px] text-red-400 mt-1 uppercase">Reason for leaving: ${exp.reason}</p>` : ''}
      </div>
    `).join('');
  }

  // Education
  const education = safeParse(app.education_json) || [];
  const eduContainer = document.getElementById('educationList');
  if (education.length === 0) {
    eduContainer.innerHTML = `<p class="text-sm text-text-soft">No education records found.</p>`;
  } else {
    eduContainer.innerHTML = education.map(edu => `
      <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-bold text-text-dark">${edu.highest_qualification || ''} — ${edu.course || ''}</h3>
            <p class="text-sm text-text-soft">${edu.institution || ''}</p>
          </div>
          <span class="text-xs font-bold bg-white border border-gray-200 px-2 py-1 rounded">${edu.graduation_year || ''}</span>
        </div>
        ${edu.certifications ? `<p class="text-xs text-royal mt-2 font-medium">Certs: ${edu.certifications}</p>` : ''}
        ${edu.trcn ? `<p class="text-xs text-emerald-600 mt-1 font-medium">TRCN: ${edu.trcn}</p>` : ''}
      </div>
    `).join('');
  }

  // Screening questions
  const questions = safeParse(app.questions_json) || {};
  document.getElementById('qWhy').textContent = questions.why || 'No response';
  document.getElementById('qValue').textContent = questions.value || 'No response';
  document.getElementById('qPhilosophy').textContent = questions.philosophy || 'No response';

  // Documents
  const docsContainer = document.getElementById('documentsList');
  const makeDoc = (label, icon, url) => url ? `
    <a href="${url}" target="_blank" rel="noreferrer" class="flex items-center gap-3 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors">
      <span class="text-xl">${icon}</span>
      <span class="text-sm font-bold flex-1">${label}</span>
      <span class="text-gold text-xs">View →</span>
    </a>
  ` : '';

  docsContainer.innerHTML = [
    makeDoc('Resume / CV', '📄', app.cv_path),
    makeDoc('Highest Certificate', '🎓', app.certificate_path),
    makeDoc('Means of ID', '🪪', app.id_path),
    makeDoc('Recommendation', '✉️', app.recommendation_path),
  ].filter(Boolean).join('') || `<p class="text-xs text-blue-200">No documents uploaded.</p>`;

  // Competencies
  const skills = safeParse(app.skills_json) || {};
  document.getElementById('skillSubjects').textContent = skills.subjects || 'N/A';
  document.getElementById('skillComputer').textContent = skills.computer || 'N/A';
  document.getElementById('skillComm').textContent = skills.communication || 'N/A';
  document.getElementById('skillLang').textContent = skills.languages || 'N/A';

  // Referees
  const referees = safeParse(app.referees_json) || [];
  const refContainer = document.getElementById('refereesList');
  if (referees.length === 0) {
    refContainer.innerHTML = `<p class="text-xs text-text-soft">No referees provided.</p>`;
  } else {
    refContainer.innerHTML = referees.map(ref => `
      <div class="text-sm border-b border-gray-100 pb-3 last:border-0 last:pb-0">
        <p class="font-bold text-text-dark">${ref.name || 'Not provided'}</p>
        <p class="text-xs text-text-soft">${ref.occupation || ''} • ${ref.relationship || ''}</p>
        ${ref.phone ? `<p class="text-xs text-royal mt-1">📞 ${ref.phone}</p>` : ''}
        ${ref.email ? `<p class="text-xs text-royal">✉️ ${ref.email}</p>` : ''}
      </div>
    `).join('');
  }
}

window.updateAppStatus = async function (status) {
  if (!confirm(`Are you sure you want to mark this applicant as ${status}?`)) return;
  try {
    await staffAPI.updateApplicationStatus(appId, status);
    window.toast.success(`Application ${status}`);
    await fetchApplication();
  } catch {
    window.toast.error('Failed to update status');
  }
};
