// admin/assets/js/auth.js
// Real database authentication and session management for Phronesis Sunesis Admin Portal
//
// Backend Architecture & Authentication Findings:
//   - Login route: The backend exposes POST /login/admin (and /admin/login is proxied / handled)
//   - Session verification: GET /admin/dashboard validates the HttpOnly JWT cookie and returns { user, role }
//   - Logout route: GET /logout/student (and /admin/logout via proxy) invalidates the HttpOnly cookie (Set-Cookie token=; Expires=1970)
//   - CSRF protection: GET / sets HttpOnly "_csrf" cookie and returns "csrfToken" in JSON body, passed via "X-CSRF-Token" header
//   - Cookie policy: Backend sets HttpOnly cookie "token=<jwt>". No tokens are stored in localStorage or sessionStorage.

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? '/api-proxy'
  : 'https://api.phronesis-sunesis.com.ng';

// Enforce rule: No authentication tokens in localStorage or sessionStorage
try {
  sessionStorage.removeItem('ps_admin_session');
  localStorage.removeItem('ps_admin_session');
  localStorage.removeItem('phronesis_jwt_token');
} catch (_) {}

// ── In-memory session state (Tab/Page execution scoped only) ───────────────────
let _currentAdmin = null;
let _inMemoryToken = null;
let _cachedCsrf = null;

/**
 * Returns the in-memory token (if available during current page execution),
 * without persisting it in localStorage or sessionStorage.
 */
export function getAuthToken() {
  return _inMemoryToken;
}

// ── CSRF Token management ─────────────────────────────────────────────────────

/**
 * Fetches and caches a CSRF token from the backend root endpoint.
 * The backend sets an HttpOnly "_csrf" cookie here as well.
 * @returns {Promise<string|null>}
 */
async function getCsrfToken() {
  if (_cachedCsrf) return _cachedCsrf;
  try {
    const res = await fetch(API_BASE + '/', {
      method: 'GET',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.csrfToken) {
        _cachedCsrf = data.csrfToken;
        return _cachedCsrf;
      }
    }
  } catch (_) {
    // Backend temporarily unreachable – CSRF not available
  }
  return null;
}

/** Invalidate the cached CSRF token. */
function invalidateCsrf() {
  _cachedCsrf = null;
}

// ── Core API fetch helper ─────────────────────────────────────────────────────

/**
 * Makes an authenticated request to the backend using cookies.
 * Attaches X-CSRF-Token header and credentials: 'include'.
 *
 * @param {string} path - e.g. '/admin/dashboard'
 * @param {object} options - fetch options (method, body, etc.)
 * @param {boolean} withCsrf - Whether to attach X-CSRF-Token header
 * @returns {Promise<Response>}
 */
async function authFetch(path, options = {}, withCsrf = false) {
  const headers = { 'Accept': 'application/json', ...(options.headers || {}) };

  if (_inMemoryToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${_inMemoryToken}`;
  }

  if (withCsrf) {
    const csrf = await getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  return fetch(API_BASE + path, {
    ...options,
    headers,
    credentials: 'include',
  });
}

// ── Public Authentication Functions ──────────────────────────────────────────

/**
 * Submits administrator credentials to the real backend API.
 * Uses real database authentication. No dummy users or fake responses.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} Authenticated admin user object
 */
export async function login(email, password) {
  if (!email || !password) {
    throw new Error('Please enter both your email address and password.');
  }

  const cleanEmail = String(email).trim();
  const cleanPassword = String(password);

  // Fetch CSRF token first (backend sets _csrf cookie here)
  const csrf = await getCsrfToken();

  const headers = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRF-Token'] = csrf;

  let res;
  let data;

  try {
    // 1. Submit credentials to the real /admin/login endpoint
    res = await fetch(API_BASE + '/admin/login', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
    });

    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    // 2. If the backend protected-route guard intercepts /admin/login directly with 401
    // (e.g. "Authentication Required" / redirect / student login fallback),
    // authenticate via the backend's dedicated admin login route /login/admin.
    if (res.status === 401 && (data?.title === 'Authentication Required' || data?.redirect)) {
      res = await fetch(API_BASE + '/login/admin', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });
      try {
        data = await res.json();
      } catch (_) {
        data = null;
      }
    }
  } catch (networkErr) {
    throw new Error('Network error connecting to authentication server. Please check your connection.');
  }

  if (!res || !res.ok) {
    const errorMsg =
      data?.message ||
      data?.error ||
      (res?.status === 401 ? 'Invalid email or password.' :
       res?.status === 403 ? 'Access denied. You do not have administrator privileges.' :
       res?.status === 429 ? 'Too many login attempts. Please wait before retrying.' :
       `Authentication failed (HTTP ${res?.status || 500}).`);

    const err = new Error(errorMsg);
    err.status = res?.status || 401;
    err.data = data;
    throw err;
  }

  // Verify backend response
  const role = data?.role || data?.data?.role || data?.user?.role || data?.admin?.role || null;
  const user = data?.user || data?.data?.user || data?.admin || {};

  // Check admin privileges
  const normalizedRole = String(role || '').toLowerCase();
  const isAdmin = ['admin', 'super admin', 'superadmin', 'administrator'].includes(normalizedRole);

  if (role && !isAdmin) {
    throw new Error('Access denied. Your account does not have administrator privileges.');
  }

  // Keep in-memory reference only — DO NOT store tokens in localStorage or sessionStorage
  if (data?.token) {
    _inMemoryToken = data.token;
  }

  _currentAdmin = {
    id: user.id || user.admin_id || null,
    email: cleanEmail,
    role: role || 'Admin',
    name: user.name || user.fullName || user.username || cleanEmail.split('@')[0],
  };

  invalidateCsrf();
  return _currentAdmin;
}

/**
 * Verifies the administrator session using the backend's actual session endpoint.
 * GET /admin/dashboard returns 200 with user & role when the session cookie is valid,
 * and 401 when unauthenticated or expired.
 *
 * @returns {Promise<object|null>}
 */
export async function getCurrentAdmin() {
  if (_currentAdmin) return _currentAdmin;

  try {
    const res = await authFetch('/admin/dashboard', { method: 'GET' });

    if (res.status === 401 || res.status === 403) {
      _currentAdmin = null;
      _inMemoryToken = null;
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const user = data?.user || data?.admin || data;
    const role = (data?.role || user?.role || '').toLowerCase();

    const isAdmin = ['admin', 'super admin', 'superadmin', 'administrator'].includes(role);
    if (!isAdmin) {
      _currentAdmin = null;
      _inMemoryToken = null;
      return null;
    }

    _currentAdmin = {
      id: user?.admin_id || user?.id || null,
      email: user?.email || '',
      role: data?.role || user?.role || 'Admin',
      name: user?.name || user?.fullName || (user?.email ? user.email.split('@')[0] : 'Admin'),
      ...user,
    };

    return _currentAdmin;
  } catch (_) {
    return null;
  }
}

/**
 * Route guard for protected admin pages.
 * Verifies the session with the backend before displaying protected content.
 * Redirects to /admin/login if not authenticated.
 *
 * @param {Function} [onAuthenticated] Callback with admin object on success
 * @returns {Promise<object|null>}
 */
export async function requireAuth(onAuthenticated) {
  const spinner = document.getElementById('auth-loading-spinner');
  const pageContent = document.getElementById('page-content');

  if (pageContent) pageContent.style.visibility = 'hidden';
  if (spinner) spinner.style.display = 'flex';

  const admin = await getCurrentAdmin();

  if (spinner) spinner.style.display = 'none';

  if (!admin) {
    const currentPath = window.location.pathname.replace(/\/+$/, '');
    const loginPath = '/admin/login';
    if (currentPath !== loginPath) {
      window.location.replace(loginPath);
    }
    return null;
  }

  if (pageContent) pageContent.style.visibility = 'visible';
  updateAdminUI(admin);

  if (typeof onAuthenticated === 'function') {
    onAuthenticated(admin);
  }

  return admin;
}

/**
 * Updates DOM elements that display admin name, role, and initials.
 * @param {object} admin
 */
export function updateAdminUI(admin) {
  if (!admin) return;
  const name = admin.name || admin.fullName || admin.username || admin.email || 'Admin';
  const role = admin.role || 'Admin';
  const initials = name ? name[0].toUpperCase() : 'A';

  document.querySelectorAll('.admin-name').forEach((el) => (el.textContent = name));
  document.querySelectorAll('.admin-role').forEach((el) => (el.textContent = role));
  document.querySelectorAll('.admin-initials').forEach((el) => (el.textContent = initials));
}

/**
 * Logs out the administrator by calling the backend logout endpoint
 * to clear the server session and expire the HttpOnly cookie.
 */
export async function logout() {
  try {
    const csrf = await getCsrfToken();
    const headers = { 'Content-Type': 'application/json' };
    if (csrf) headers['X-CSRF-Token'] = csrf;

    // Call logout endpoint to clear HttpOnly cookie
    await fetch(API_BASE + '/admin/logout', {
      method: 'POST',
      headers,
      credentials: 'include',
    }).catch(() => {});

    // Also call backend's student/cookie clear route directly as backup
    await fetch(API_BASE + '/logout/student', {
      method: 'GET',
      credentials: 'include',
    }).catch(() => {});
  } catch (_) {
    // Ignore network errors during logout
  }

  // Clear in-memory state
  _currentAdmin = null;
  _inMemoryToken = null;
  invalidateCsrf();

  // Clear any legacy web storage
  try {
    sessionStorage.clear();
    localStorage.removeItem('ps_admin_session');
    localStorage.removeItem('phronesis_jwt_token');
  } catch (_) {}

  window.location.replace('/admin/login');
}

// ── Backward-compatible authAPI shim for api.js ───────────────────────────────
export const authAPI = {
  login: (data) => login(data.email, data.password),
  logout: () => logout(),
  me: () => getCurrentAdmin(),
};

// ── Global window exposure ────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.auth = {
    getCurrentAdmin,
    requireAuth,
    login,
    logout,
    updateAdminUI,
    getAuthToken,
  };
}
