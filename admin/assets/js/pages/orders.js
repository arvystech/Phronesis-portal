// admin/js/pages/orders.js
import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { paymentsAPI } from '../api.js';
import { formatCurrency, formatDate } from '../helpers.js';

let allOrders = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('orders', 'Fee Payments & Orders');

  await requireAuth(() => {
    initOrders();
  });
});

async function initOrders() {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  try {
    const res = await paymentsAPI.list();
    allOrders = res.data?.data || [];
    renderOrders(allOrders);
    renderOrderStats(allOrders);
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
}

function renderOrderStats(orders) {
  const revEl = document.getElementById('ordersTotalRevenue');
  const countEl = document.getElementById('ordersCompletedCount');
  const outEl = document.getElementById('ordersOutstanding');

  const totalRev = orders.filter(o => o.status === 'Paid').reduce((sum, o) => sum + (o.amount || 0), 0);
  const completedCount = orders.filter(o => o.status === 'Paid').length;
  const outstanding = orders.filter(o => o.status === 'Pending').reduce((sum, o) => sum + (o.amount || 0), 0);

  if (revEl) revEl.textContent = formatCurrency(totalRev);
  if (countEl) countEl.textContent = completedCount;
  if (outEl) outEl.textContent = formatCurrency(outstanding);
}

function renderOrders(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-text-soft py-10">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map((order) => {
    const badgeClass =
      order.status === 'Paid'
        ? 'bg-emerald-100 text-emerald-700'
        : order.status === 'Failed'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';

    return `
      <tr class="hover:bg-warm-white/60 transition-colors">
        <td class="px-5 py-3 font-mono text-xs text-royal font-medium">${order.orderId}</td>
        <td class="px-5 py-3 text-xs font-semibold text-text-dark">${order.studentName}</td>
        <td class="px-5 py-3 text-xs text-text-soft">${order.category}</td>
        <td class="px-5 py-3 text-xs font-bold text-text-dark">${formatCurrency(order.amount)}</td>
        <td class="px-5 py-3">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${badgeClass}">${order.status}</span>
        </td>
      </tr>
    `;
  }).join('');
}
