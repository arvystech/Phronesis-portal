// admin/js/pages/staff-applications.js
import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { staffAPI } from '../api.js';

let applications = [];
let currentFilter = 'All';

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('staff', 'Staff Applications');

  await requireAuth(() => {
    initStaffApplications();
  });
});

async function initStaffApplications() {
  bindFilterButtons();
  await fetchApplications();
}

function bindFilterButtons() {
  const buttons = document.querySelectorAll('[data-filter-btn]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.getAttribute('data-filter-btn');

      buttons.forEach(b => {
        if (b.getAttribute('data-filter-btn') === currentFilter) {
          b.className = 'px-4 py-1.5 text-xs font-bold rounded-lg transition-colors bg-royal text-white shadow-sm';
        } else {
          b.className = 'px-4 py-1.5 text-xs font-bold rounded-lg transition-colors text-text-soft hover:bg-gray-50';
        }
      });

      renderFiltered();
    });
  });
}

async function fetchApplications() {
  const tbody = document.getElementById('applicationsTableBody');
  tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-text-soft">Loading applications...</td></tr>`;

  try {
    const res = await staffAPI.listApplications();
    applications = res.data?.data || [];
    renderFiltered();
  } catch (err) {
    console.error(err);
    window.toast.error('Failed to load applications');
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-red-500">Failed to load applications.</td></tr>`;
  }
}

function renderFiltered() {
  const tbody = document.getElementById('applicationsTableBody');
  const filtered = applications.filter(a => currentFilter === 'All' || a.status === currentFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-text-soft">No applications found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(app => {
    const avatar = app.passport_path
      ? `<img src="${app.passport_path}" class="w-full h-full rounded-full object-cover" />`
      : (app.fullname ? app.fullname[0] : 'S');

    const statusBadgeClass =
      app.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
      app.status === 'Rejected' ? 'bg-red-100 text-red-700' :
      'bg-amber-100 text-amber-700';

    const appId = app.application_id || app.id;

    return `
      <tr class="hover:bg-royal/5 transition-colors group">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-royal/10 flex items-center justify-center text-royal font-bold shadow-inner overflow-hidden shrink-0">
              ${avatar}
            </div>
            <div>
              <p class="font-bold text-text-dark">${app.fullname || '—'}</p>
              <p class="text-[10px] text-text-soft">${app.email || '—'}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <p class="font-bold text-text-dark">${app.position_applied || 'N/A'}</p>
          <p class="text-[10px] text-text-soft uppercase tracking-wider">${app.role_category || app.employment_type || ''}</p>
        </td>
        <td class="px-6 py-4">
          <span class="bg-gray-100 text-text-dark px-2.5 py-1 rounded-md font-medium text-xs">
            ${app.years_of_experience || 0} yrs
          </span>
        </td>
        <td class="px-6 py-4 text-text-soft">
          ${app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}
        </td>
        <td class="px-6 py-4">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass}">
            ${app.status || 'Pending'}
          </span>
        </td>
        <td class="px-6 py-4 text-right space-x-2">
          <a
            href="/admin/staff-applications/${encodeURIComponent(appId)}"
            class="text-xs font-bold text-royal hover:text-royal-light bg-royal/5 hover:bg-royal/10 px-3 py-1.5 rounded-lg transition-colors inline-block"
          >
            View Details
          </a>
        </td>
      </tr>
    `;
  }).join('');
}
