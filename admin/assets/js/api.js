// admin/assets/js/api.js
// Native fetch client for Phronesis Sunesis Admin Portal
// Connected directly to Live Backend API (No mock data, no mock authentication)

import { login, logout, getCurrentAdmin, getAuthToken } from './auth.js';

const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? '/api-proxy'
  : 'https://api.phronesis-sunesis.com.ng';

let _cachedCsrf = null;

/**
 * Fetches CSRF token from the API root if needed for state-changing operations.
 */
async function getCsrfToken() {
  if (_cachedCsrf) return _cachedCsrf;
  try {
    const res = await fetch(API_BASE_URL + '/', { method: 'GET', credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        _cachedCsrf = data.csrfToken;
        return _cachedCsrf;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Core HTTP request handler.
 * Attaches Bearer JWT and CSRF headers, sends real requests to the API,
 * and handles genuine errors without falling back to mock data.
 *
 * @param {string} url - e.g. '/staff', '/student', '/admin/login'
 * @param {object} options - fetch options & custom configs
 * @returns {Promise<{ data: any, status: number, ok: boolean }>}
 */
async function request(url, options = {}) {
  const { skipAuthRedirect, params, ...customConfig } = options;

  let fullUrl = API_BASE_URL + url;
  if (params && Object.keys(params).length > 0) {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    }
    const qStr = query.toString();
    if (qStr) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + qStr;
    }
  }

  const headers = { ...(customConfig.headers || {}) };
  let body = customConfig.body;

  // Auto-handle JSON body
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    body = JSON.stringify(body);
  }

  // Attach Authorization Bearer token if available in-memory
  const token = getAuthToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Attach CSRF token on state-changing methods (POST, PUT, PATCH, DELETE)
  const method = (customConfig.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && !headers['X-CSRF-Token']) {
    const csrf = await getCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  const config = {
    method,
    credentials: 'include',
    headers,
    body,
  };

  const res = await fetch(fullUrl, config);

  if (res.status === 401) {
    const cleanPath = window.location.pathname.replace(/\/+$/, '');
    const isLoginPage = cleanPath.endsWith('/login.html') || cleanPath === '/login' || cleanPath === '/admin/login';
    if (!skipAuthRedirect && !isLoginPage) {
      window.location.replace('/admin/login');
    }
  }

  const contentType = res.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg = (data && (data.message || data.error)) || res.statusText || `Request failed with status ${res.status}`;
    const error = new Error(errorMsg);
    error.status = res.status;
    error.response = { status: res.status, data };
    throw error;
  }

  return { data, status: res.status, ok: res.ok };
}

const client = {
  get: (url, config = {}) => request(url, { ...config, method: 'GET' }),
  post: (url, body, config = {}) => request(url, { ...config, method: 'POST', body }),
  put: (url, body, config = {}) => request(url, { ...config, method: 'PUT', body }),
  patch: (url, body, config = {}) => request(url, { ...config, method: 'PATCH', body }),
  delete: (url, config = {}) => request(url, { ...config, method: 'DELETE' }),
};

function smartPost(url, data, extraConfig = {}) {
  return client.post(url, data, extraConfig);
}

function smartPut(url, data, extraConfig = {}) {
  return client.put(url, data, extraConfig);
}

// ── Authentication (Connected to live API via auth.js) ──────────────────────
export const authAPI = {
  login:  (data) => login(data.email, data.password),
  logout: ()     => logout(),
  me:     ()     => getCurrentAdmin(),
};

// ── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardAPI = {
  get: () => client.get('/dashboard'),
};

// ── Students & Sub-resources (Live API) ────────────────────────────────────
export const studentsAPI = {
  list: async (params) => {
    try {
      return await client.get('/admin/students', { params });
    } catch (e) {
      if (e.response?.status === 404) {
        return await client.get('/student', { params });
      }
      throw e;
    }
  },
  get: async (id) => {
    try {
      return await client.get(`/admin/students/${id}`);
    } catch (e) {
      if (e.response?.status === 404) {
        return await client.get(`/student/${id}`);
      }
      throw e;
    }
  },
  create: async (data) => {
    try {
      return await smartPost('/student/register', data);
    } catch (e) {
      if (e.response?.status === 404) {
        return await smartPost('/student', data);
      }
      throw e;
    }
  },
  update:       (id, data)   => smartPut(`/student/${id}`, data),
  updateStatus: (id, status) => client.patch(`/student/${id}/status`, { status }),
  delete:       (id)         => client.delete(`/student/${id}`),

  getResults:    (id)        => client.get(`/student/${id}/results`),
  addResult:     (id, data)  => client.post(`/student/${id}/results`, data),

  getAttendance: (id)        => client.get(`/student/${id}/attendance`),
  addAttendance: (id, data)  => client.post(`/student/${id}/attendance`, data),

  getPayments:   (id)        => client.get(`/student/${id}/payments`),
  addPayment:    (id, data)  => client.post(`/student/${id}/payments`, data),

  getBehaviors:  (id)        => client.get(`/student/${id}/behaviors`),
  addBehavior:   (id, data)  => client.post(`/student/${id}/behaviors`, data),

  transfer:      (id, data)  => client.post(`/student/${id}/transfer`, data),
  promote:       (id, data)  => client.post(`/student/${id}/promote`, data),
};

// ── Staff (Live API at /admin/staff & /admin/add-staff) ───────────────────
export const staffAPI = {
  list: async (params) => {
    try {
      return await client.get('/admin/staff', { params });
    } catch (e) {
      if (e.response?.status === 404) {
        return await client.get('/staff', { params });
      }
      throw e;
    }
  },
  get: async (id) => {
    try {
      return await client.get(`/admin/staff/${id}`);
    } catch (e) {
      if (e.response?.status === 404) {
        return await client.get(`/staff/${id}`);
      }
      throw e;
    }
  },
  create: (data) => smartPost('/admin/add-staff', data),
  update: async (id, data) => {
    try {
      return await smartPut(`/admin/staff/${id}`, data);
    } catch (e) {
      if (e.response?.status === 404) {
        return await smartPut(`/staff/${id}`, data);
      }
      throw e;
    }
  },
  delete: async (id) => {
    try {
      return await client.delete(`/admin/staff/${id}`);
    } catch (e) {
      if (e.response?.status === 404) {
        return await client.delete(`/staff/${id}`);
      }
      throw e;
    }
  },

  listApplications: async (params) => {
    try {
      return await client.get('/admin/staff/applications', { params });
    } catch (e) {
      if (e.response?.status === 404) {
        return await client.get('/staff/applications', { params });
      }
      throw e;
    }
  },
  getApplication: async (id) => {
    try {
      return await client.get(`/admin/staff/applications/${id}`);
    } catch (e) {
      if (e.response?.status === 404) {
        return await client.get(`/staff/applications/${id}`);
      }
      throw e;
    }
  },
  submitApplication: (data) => smartPost('/staff/applications', data),
  updateApplicationStatus: (id, status) => client.patch(`/admin/staff/applications/${id}/status`, { status }),
  deleteApplication: (id) => client.delete(`/admin/staff/applications/${id}`),
};

// ── Staff Attendance (Live Admin API at /admin/staff-attendance) ───────────
export const staffAttendanceAPI = {
  list:         (params) => client.get('/admin/staff-attendance', { params }),
  getByStaffId: (id, params) => client.get(`/admin/staff/${id}/attendance`, { params }),
};

// ── Admissions ─────────────────────────────────────────────────────────────
export const admissionsAPI = {
  list:         (params)     => client.get('/admissions/applications', { params }),
  get:          (id)         => client.get(`/admissions/applications/${id}`),
  create:       (data)       => smartPost('/admissions/applications', data),
  updateStatus: (id, status) => client.patch(`/admissions/applications/${id}/status`, { status }),
  delete:       (id)         => client.delete(`/admissions/applications/${id}`),
};

// ── Classes ────────────────────────────────────────────────────────────────
export const classesAPI = {
  list:        (params)    => client.get('/classes', { params }),
  get:         (id)        => client.get(`/classes/${id}`),
  getStudents: (id)        => client.get(`/classes/${id}/students`),
  create:      (data)      => client.post('/classes', data),
  update:      (id, data)  => client.put(`/classes/${id}`, data),
  delete:      (id)        => client.delete(`/classes/${id}`),
};

// ── Subjects ───────────────────────────────────────────────────────────────
export const subjectsAPI = {
  list:   (params)    => client.get('/subjects', { params }),
  get:    (id)        => client.get(`/subjects/${id}`),
  create: (data)      => client.post('/subjects', data),
  update: (id, data)  => client.put(`/subjects/${id}`, data),
  delete: (id)        => client.delete(`/subjects/${id}`),
};

// ── Attendance ─────────────────────────────────────────────────────────────
export const attendanceAPI = {
  list:   (params)    => client.get('/attendance', { params }),
  get:    (id)        => client.get(`/attendance/${id}`),
  create: (data)      => client.post('/attendance', data),
  update: (id, data)  => client.put(`/attendance/${id}`, data),
  delete: (id)        => client.delete(`/attendance/${id}`),
};

// ── Academic Results ───────────────────────────────────────────────────────
export const resultsAPI = {
  list:   (params)    => client.get('/results', { params }),
  get:    (id)        => client.get(`/results/${id}`),
  create: (data)      => client.post('/results', data),
  update: (id, data)  => client.put(`/results/${id}`, data),
  delete: (id)        => client.delete(`/results/${id}`),
};

// ── Payments ───────────────────────────────────────────────────────────────
export const paymentsAPI = {
  list:   (params)    => client.get('/payments', { params }),
  get:    (id)        => client.get(`/payments/${id}`),
  create: (data)      => client.post('/payments', data),
  update: (id, data)  => client.put(`/payments/${id}`, data),
  delete: (id)        => client.delete(`/payments/${id}`),
};

if (typeof window !== 'undefined') {
  window.api = {
    authAPI,
    dashboardAPI,
    studentsAPI,
    staffAPI,
    staffAttendanceAPI,
    admissionsAPI,
    classesAPI,
    subjectsAPI,
    attendanceAPI,
    resultsAPI,
    paymentsAPI,
  };
}
