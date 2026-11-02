// admin/assets/js/pages/login.js
// Login page controller for Phronesis Sunesis Admin Portal
//
// Flow:
//   1. On page load, check if already authenticated via backend session.
//      If yes, redirect to /admin/staffs (the default post-login landing page).
//   2. On form submit, call login() from auth.js, which:
//      a. Fetches a CSRF token from the backend root
//      b. POSTs credentials to POST /admin/login
//      c. Stores the JWT token in sessionStorage on success
//   3. On success, redirect to /admin/staffs.
//   4. On failure, show the error message from the backend without exposing tokens.

import { login, getCurrentAdmin } from '../auth.js';

// The default landing page after successful admin login
const POST_LOGIN_REDIRECT = '/admin/staffs';
const LOGIN_PATH = '/admin/login';

document.addEventListener('DOMContentLoaded', async () => {
  // ── Already authenticated? Redirect to staffs ─────────────────────────────
  // If the session is valid, skip the login page.
  // We check silently so the login form is not briefly shown before redirect.
  const loadingOverlay = document.getElementById('loginLoadingOverlay');
  if (loadingOverlay) loadingOverlay.style.display = 'flex';

  try {
    const current = await getCurrentAdmin();
    if (current) {
      // Already authenticated — go to the protected area
      window.location.replace(POST_LOGIN_REDIRECT);
      return;
    }
  } catch (_) {
    // Session check failed — stay on login page
  }

  if (loadingOverlay) loadingOverlay.style.display = 'none';

  // ── Bind the login form ───────────────────────────────────────────────────
  const form       = document.getElementById('loginForm');
  const emailInput = document.getElementById('emailInput');
  const pwInput    = document.getElementById('passwordInput');
  const submitBtn  = document.getElementById('submitBtn');
  const btnText    = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  const errorBanner = document.getElementById('loginError');
  const errorMsg   = document.getElementById('loginErrorMsg');

  if (!form) return; // Should not happen, but guard just in case

  function showError(msg) {
    if (errorBanner) errorBanner.classList.remove('hidden');
    if (errorMsg) errorMsg.textContent = msg || 'An unexpected error occurred. Please try again.';
  }

  function hideError() {
    if (errorBanner) errorBanner.classList.add('hidden');
    if (errorMsg) errorMsg.textContent = '';
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    if (btnText)    btnText.classList.toggle('hidden', isLoading);
    if (btnSpinner) btnSpinner.classList.toggle('hidden', !isLoading);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email    = (emailInput?.value || '').trim();
    const password = pwInput?.value || '';

    if (!email || !password) {
      showError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);

      // Login succeeded — show a brief success toast then redirect
      if (window.toast?.success) {
        window.toast.success('Welcome back! Redirecting…');
      }

      // Short delay so the success message is visible before navigation
      setTimeout(() => {
        window.location.replace(POST_LOGIN_REDIRECT);
      }, 350);

    } catch (err) {
      // Login failed — extract a user-friendly message from the error
      const msg =
        err?.message ||
        err?.data?.message ||
        'Login failed. Please check your credentials and try again.';

      showError(msg);

      if (window.toast?.error) {
        window.toast.error(msg);
      }

      setLoading(false);

      // Refocus the password field for quick retry (don't clear email)
      if (pwInput) {
        pwInput.value = '';
        pwInput.focus();
      }
    }
  });

  // Clear the error banner whenever the user starts typing
  [emailInput, pwInput].forEach((input) => {
    if (input) {
      input.addEventListener('input', hideError);
    }
  });
});
