// admin/js/layout.js
// Handles shared layout logic: active link highlighting, sign out button, user profile display

import { logout, updateAdminUI } from './auth.js';

export function setupLayout(activeNavKey, pageTitleText) {
  // Update page title if specified
  if (pageTitleText) {
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = pageTitleText;
  }

  // Update active state in sidebar
  document.querySelectorAll('.sidebar-item').forEach((item) => {
    const key = item.getAttribute('data-nav');
    if (key === activeNavKey) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update active state in bottom nav
  document.querySelectorAll('[data-bottom-nav]').forEach((item) => {
    const key = item.getAttribute('data-bottom-nav');
    if (key === activeNavKey) {
      item.className = 'flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 text-royal font-bold scale-105';
    } else {
      item.className = 'flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 text-text-soft hover:text-royal-deep';
    }
  });

  // Bind logout buttons
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await logout();
    });
  }
}
