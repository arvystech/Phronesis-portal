// admin/js/pages/login.js
import { login, getCurrentAdmin } from '../auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // If already logged in, redirect to index.html
  const current = await getCurrentAdmin();
  if (current) {
    window.location.href = '/admin/dashboard';
    return;
  }

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) return;

    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    try {
      await login(email, password);
      window.toast.success('Welcome back!');
      setTimeout(() => {
        window.location.href = '/admin/dashboard';
      }, 400);
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Check credentials.';
      window.toast.error(msg);
      submitBtn.disabled = false;
      btnText.classList.remove('hidden');
      btnSpinner.classList.add('hidden');
    }
  });
});
