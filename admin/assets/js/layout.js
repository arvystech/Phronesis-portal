// admin/js/layout.js
// Handles shared layout logic: active link highlighting, sign out button, user profile display

import { logout, updateAdminUI } from './auth.js';

export function setupLayout(activeNavKey, pageTitleText) {
  ensureAdminNavigation(activeNavKey);
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
      item.className = 'flex flex-col items-center justify-center py-2 px-2 rounded-xl transition-all duration-200 text-royal font-bold scale-105 shrink-0';
    } else {
      item.className = 'flex flex-col items-center justify-center py-2 px-2 rounded-xl transition-all duration-200 text-text-soft hover:text-royal-deep shrink-0';
    }
  });

  // Bind logout buttons
  const logoutHandlers = [
    document.getElementById('sidebarLogoutBtn'),
    document.getElementById('mobileDrawerLogoutBtn'),
    ...document.querySelectorAll('.logout-btn, [data-action="logout"]')
  ].filter(Boolean);

  logoutHandlers.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await logout();
    });
  });

  // Ensure sidebar admin icon and admin profile container are clickable and redirect to profile
  const sidebarAdminElements = document.querySelectorAll(
    'aside .admin-initials, aside .sidebar-admin-link, aside [data-action="profile"]'
  );
  sidebarAdminElements.forEach((el) => {
    el.style.cursor = 'pointer';
    const parentLink = el.closest('a');
    if (!parentLink) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/admin/profile';
      });
    }
  });
}

const adminNavItems = [
  { key: 'dashboard', href: '/admin/dashboard', icon: '⌂', label: 'Dashboard' },
  { key: 'staffs', href: '/admin/staffs', icon: '♟', label: 'Staffs' },
  { key: 'staff-attendance', href: '/admin/staff-attendance', icon: '▤', label: 'Staff Attendance' },
  { key: 'cbt', href: '/admin/cbt', icon: '✎', label: 'CBT Questions' },
  { key: 'cbt-students', href: '/admin/cbt-students', icon: '☷', label: 'CBT Students' },
  { key: 'profile', href: '/admin/profile', icon: '●', label: 'Profile' },
];

function ensureAdminNavigation(activeNavKey) {
  const sidebar = document.querySelector('aside nav[aria-label="Main navigation"], aside nav');
  if (sidebar) {
    sidebar.setAttribute('aria-label', 'Main navigation');
    sidebar.className = 'flex-1 px-3 py-4 space-y-1 overflow-y-auto';
    sidebar.innerHTML = `<p class="text-blue-400 text-[10px] uppercase tracking-widest font-semibold px-3 mb-2">Main Menu</p>${adminNavItems.map((item) => `<a href="${item.href}" class="sidebar-item${item.key === activeNavKey ? ' active' : ''}" data-nav="${item.key}"><span class="w-5 text-center">${item.icon}</span><span>${item.label}</span></a>`).join('')}`;
  }

  document.querySelectorAll('nav[aria-label="Mobile navigation"], nav.fixed.bottom-0').forEach((nav) => nav.remove());
  const header = document.querySelector('header');
  if (!header) return;
  let menuButton = document.getElementById('mobileAdminMenuButton');
  if (!menuButton) {
    menuButton = document.createElement('button');
    menuButton.id = 'mobileAdminMenuButton';
    menuButton.className = 'mobile-admin-menu-button';
    menuButton.type = 'button';
    menuButton.setAttribute('aria-label', 'Open admin menu');
    menuButton.setAttribute('aria-controls', 'mobileAdminDrawer');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.innerHTML = '<span></span><span></span><span></span>';
    header.insertBefore(menuButton, header.firstChild);
  }

  let drawer = document.getElementById('mobileAdminDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'mobileAdminDrawer';
    drawer.className = 'mobile-admin-drawer';
    drawer.hidden = true;
    document.body.append(drawer);
  }
  drawer.innerHTML = `<button class="mobile-admin-drawer-backdrop" type="button" data-close-admin-menu aria-label="Close admin menu"></button><aside class="mobile-admin-drawer-panel" role="dialog" aria-modal="true" aria-label="Admin navigation"><div class="mobile-admin-drawer-header"><div class="mobile-admin-brand"><img src="/admin/assets/images/logo/logo.png" alt=""><span><strong>Phronesis</strong><small>Sunesis Admin</small></span></div><button class="mobile-admin-drawer-close" type="button" data-close-admin-menu aria-label="Close menu">×</button></div><nav class="mobile-admin-links" aria-label="Mobile admin navigation">${adminNavItems.map((item) => `<a href="${item.href}" class="sidebar-item${item.key === activeNavKey ? ' active' : ''}" data-nav="${item.key}"><span class="w-5 text-center">${item.icon}</span><span>${item.label}</span></a>`).join('')}</nav><div class="mobile-admin-drawer-footer"><a href="/admin/profile" class="mobile-admin-profile"><span class="admin-initials">A</span><span><strong class="admin-name">Admin</strong><small class="admin-role">Admin</small></span></a><button id="mobileDrawerLogoutBtn" class="mobile-admin-logout" type="button">⇥ Sign out</button></div></aside>`;

  const closeDrawer = () => {
    drawer.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('mobile-admin-menu-open');
    menuButton.focus();
  };
  menuButton.onclick = () => {
    drawer.hidden = false;
    menuButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('mobile-admin-menu-open');
    drawer.querySelector('.mobile-admin-drawer-close').focus();
  };
  drawer.querySelectorAll('[data-close-admin-menu]').forEach((button) => { button.onclick = closeDrawer; });
  drawer.querySelectorAll('a').forEach((link) => { link.onclick = closeDrawer; });
  drawer.onkeydown = (event) => { if (event.key === 'Escape') closeDrawer(); };
}
