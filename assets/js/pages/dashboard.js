// admin/js/pages/dashboard.js
import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { dashboardAPI } from '../api.js';
import { formatCurrency, formatDate, statusColor } from '../helpers.js';

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('dashboard', 'Dashboard');

  await requireAuth(async () => {
    loadDashboard();
  });
});

async function loadDashboard() {
  const loadingEl = document.getElementById('dashboardLoading');
  const contentEl = document.getElementById('dashboardContent');

  try {
    const res = await dashboardAPI.get();
    const data = res.data?.data || {};
    renderDashboard(data);
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load dashboard:', err);
    loadingEl.innerHTML = `
      <div class="text-center py-10">
        <p class="text-sm text-red-500 font-semibold mb-2">Failed to load dashboard data.</p>
        <button onclick="location.reload()" class="btn-secondary text-xs mx-auto">Retry</button>
      </div>
    `;
  }
}

function renderDashboard(data) {
  const s = data.stats || {};

  // Row 1
  document.getElementById('statTotal').textContent = s.total ?? 0;
  document.getElementById('statPending').textContent = s.pending ?? 0;
  document.getElementById('statRevenue').textContent = formatCurrency(s.revenue);
  document.getElementById('statOutstanding').textContent = formatCurrency(s.outstanding);

  // Row 2
  document.getElementById('statApproved').textContent = s.approved ?? 0;
  document.getElementById('statAdmitted').textContent = s.admitted ?? 0;
  document.getElementById('statRejected').textContent = s.rejected ?? 0;
  const staffStatEl = document.getElementById('statTotalStaff') || document.getElementById('statSession');
  if (staffStatEl) staffStatEl.textContent = s.totalStaff ?? s.total ?? 0;

  // Monthly Revenue Chart
  renderRevenueChart(data.monthlyRevenue || []);

  // Class Distribution
  renderClassDistribution(data.classDistribution || [], s.total || 0);

  // Recent Registrations
  renderRecentRegistrations(data.recentRegistrations || []);
}

function renderRevenueChart(monthlyRevenue) {
  const container = document.getElementById('revenueChartContainer');
  if (!monthlyRevenue || monthlyRevenue.length === 0) {
    container.innerHTML = `<div class="h-48 flex items-center justify-center text-text-soft text-sm w-full">No revenue data yet</div>`;
    return;
  }

  const maxRev = Math.max(...monthlyRevenue.map((m) => m.revenue || 0), 1000);
  const chartHeight = 180;

  let svgHtml = `
    <svg viewBox="0 0 600 ${chartHeight + 30}" class="w-full h-full overflow-visible" preserveAspectRatio="none">
  `;

  // Horizontal grid lines
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const yVal = (chartHeight / steps) * i;
    const revVal = Math.round(maxRev - (maxRev / steps) * i);
    svgHtml += `
      <line x1="45" y1="${yVal}" x2="600" y2="${yVal}" stroke="#E7E1D1" stroke-dasharray="3 3" opacity="0.6" />
      <text x="0" y="${yVal + 4}" fill="#667085" font-size="10" font-family="Inter, sans-serif">₦${(revVal / 1000).toFixed(0)}k</text>
    `;
  }

  const barCount = monthlyRevenue.length;
  const availableWidth = 555;
  const slotWidth = availableWidth / barCount;
  const barWidth = 28;

  monthlyRevenue.forEach((item, index) => {
    const rev = item.revenue || 0;
    const barH = Math.max((rev / maxRev) * (chartHeight - 10), 4);
    const x = 45 + index * slotWidth + (slotWidth - barWidth) / 2;
    const y = chartHeight - barH;
    const isLast = index === monthlyRevenue.length - 1;
    const fill = isLast ? '#D4B15A' : '#17338F';

    svgHtml += `
      <g class="cursor-pointer group">
        <title>${item.month}: ${formatCurrency(rev)}</title>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="6" ry="6" fill="${fill}" class="transition-all hover:opacity-85" />
        <text x="${x + barWidth / 2}" y="${chartHeight + 20}" fill="#667085" font-size="11" font-family="Inter, sans-serif" text-anchor="middle font-medium">${item.month}</text>
      </g>
    `;
  });

  svgHtml += `</svg>`;
  container.innerHTML = svgHtml;
}

function renderClassDistribution(classes, total) {
  const container = document.getElementById('classDistributionList');
  if (!classes || classes.length === 0) {
    container.innerHTML = `<p class="text-text-soft text-sm text-center py-6">No students yet</p>`;
    return;
  }

  container.innerHTML = classes.map((c) => {
    const pct = Math.round((c.count / (total || 1)) * 100);
    return `
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="font-medium text-text-dark">${c.class || c.class_applied || '—'}</span>
          <span class="text-text-soft">${c.count}</span>
        </div>
        <div class="h-1.5 bg-border rounded-full overflow-hidden">
          <div class="h-full bg-royal rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentRegistrations(recent) {
  const tbody = document.getElementById('recentRegistrationsBody');
  if (!recent || recent.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-text-soft py-10 text-sm">No registrations yet</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recent.map((s) => {
    const avatar = s.studentPassport
      ? `<img src="${s.studentPassport}" alt="${s.fullName}" class="w-full h-full object-cover" />`
      : (s.fullName ? s.fullName[0] : '?');

    return `
      <tr onclick="window.location.href='student-details.html?id=${s.id}'" class="hover:bg-warm-white/60 transition-colors cursor-pointer">
        <td class="px-5 py-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-warm-white border border-gold/30 flex items-center justify-center text-royal text-xs font-bold overflow-hidden shrink-0">
              ${avatar}
            </div>
            <div>
              <p class="font-semibold text-text-dark text-xs">${s.fullName}</p>
              <p class="text-text-soft text-[10px]">${s.registrationNumber || ''}</p>
            </div>
          </div>
        </td>
        <td class="px-5 py-3 text-xs text-text-soft">${s.class}</td>
        <td class="px-5 py-3 text-xs text-text-soft hidden md:table-cell">${formatDate(s.registrationDate)}</td>
        <td class="px-5 py-3 text-xs font-semibold text-text-dark hidden lg:table-cell">${formatCurrency(s.amountPaid)}</td>
        <td class="px-5 py-3">
          <span class="${statusColor(s.admissionStatus)}">${s.admissionStatus}</span>
        </td>
      </tr>
    `;
  }).join('');
}
