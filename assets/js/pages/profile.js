// admin/js/pages/profile.js
import { requireAuth, logout } from '../auth.js';
import { setupLayout } from '../layout.js';
import { formatDate } from '../helpers.js';

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('profile', 'Admin Profile');

  await requireAuth((admin) => {
    initProfile(admin);
  });
});

function initProfile(admin) {
  const initials = admin.name ? admin.name[0].toUpperCase() : 'A';
  document.getElementById('profileInitials').textContent = initials;
  document.getElementById('profileName').textContent = admin.name || 'Admin';
  document.getElementById('profileRole').textContent = admin.role || 'Super Admin';
  document.getElementById('profileEmail').textContent = admin.email || 'admin@phronesis.com';

  document.getElementById('accountRole').textContent = admin.role || 'Super Admin';
  document.getElementById('accountLastLogin').textContent = formatDate(new Date());

  // Bind settings toggles
  const pushToggle = document.getElementById('pushToggle');
  const pushThumb = document.getElementById('pushThumb');
  let pushActive = true;
  pushToggle.addEventListener('click', () => {
    pushActive = !pushActive;
    pushToggle.className = `w-10 h-6 ${pushActive ? 'bg-emerald-500 justify-end' : 'bg-border justify-start'} rounded-full flex items-center px-1 cursor-pointer transition-colors`;
  });

  const autoToggle = document.getElementById('autoToggle');
  const autoThumb = document.getElementById('autoThumb');
  let autoActive = false;
  autoToggle.addEventListener('click', () => {
    autoActive = !autoActive;
    autoToggle.className = `w-10 h-6 ${autoActive ? 'bg-emerald-500 justify-end' : 'bg-border justify-start'} rounded-full flex items-center px-1 cursor-pointer transition-colors`;
  });

  // Bind sign out
  const signOutBtn = document.getElementById('profileSignOutBtn');
  signOutBtn.addEventListener('click', async () => {
    await logout();
  });
}
