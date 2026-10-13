// admin/js/auth.js
// Vanilla session authentication management

import { authAPI } from './api.js';

let currentAdmin = null;

export async function getCurrentAdmin() {
  if (currentAdmin) return currentAdmin;
  try {
    const res = await authAPI.me();
    currentAdmin = res.data?.admin || null;
    return currentAdmin;
  } catch {
    currentAdmin = null;
    return null;
  }
}

export async function requireAuth(onAuthenticated) {
  // Show minimal initial loading spinner if element present
  const spinner = document.getElementById('auth-loading-spinner');
  if (spinner) spinner.style.display = 'flex';

  const admin = await getCurrentAdmin();
  if (spinner) spinner.style.display = 'none';

  if (!admin) {
    window.location.href = './login.html';
    return null;
  }

  // Populate any admin headers/chips in layout if available
  updateAdminUI(admin);

  if (typeof onAuthenticated === 'function') {
    onAuthenticated(admin);
  }
  return admin;
}

export function updateAdminUI(admin) {
  if (!admin) return;
  const initials = admin.name ? admin.name[0].toUpperCase() : 'A';

  // Desktop/Navbar avatar & info
  document.querySelectorAll('.admin-name').forEach(el => el.textContent = admin.name || 'Admin');
  document.querySelectorAll('.admin-role').forEach(el => el.textContent = admin.role || 'Staff');
  document.querySelectorAll('.admin-initials').forEach(el => el.textContent = initials);
}

export async function login(email, password) {
  const res = await authAPI.login({ email, password });
  currentAdmin = res.data?.admin || null;
  return res.data;
}

export async function logout() {
  try {
    await authAPI.logout();
  } catch (e) {
    console.error(e);
  }
  currentAdmin = null;
  window.location.href = 'login.html';
}

if (typeof window !== 'undefined') {
  window.auth = {
    getCurrentAdmin,
    requireAuth,
    login,
    logout,
  };
}
