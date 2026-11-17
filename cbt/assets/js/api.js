const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '/api-proxy'
  : 'https://api.phronesis-sunesis.com.ng';
let csrfToken = null;

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers['X-CSRF-Token']) {
    csrfToken ||= await fetchCsrf();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const responseToken = response.headers.get('X-CSRF-Token');
  if (responseToken) csrfToken = responseToken;
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.message || data?.error || response.statusText || 'Request failed');
    error.status = response.status || data?.statusCode;
    error.code = data?.code;
    error.payload = data;
    throw error;
  }
  return data;
}

async function fetchCsrf() {
  try {
    const response = await fetch(`${API_BASE}/`, { credentials: 'include', headers: { Accept: 'application/json' } });
    const headerToken = response.headers.get('X-CSRF-Token');
    if (headerToken) return headerToken;
    if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) {
      return (await response.json()).csrfToken || null;
    }
  } catch (_) { /* A cookie CSRF token may not be needed by this backend. */ }
  return null;
}

export const cbtStudentAPI = {
  access: (admissionNumber) => request('/cbt/access', {
    method: 'POST', body: { admissionNumber },
  }),
  listExams: () => request('/cbt/exams'),
  logoutCandidate: () => request('/cbt/logout', { method: 'POST', body: {} }),
  startAttempt: (examId) => request(`/cbt/exams/${encodeURIComponent(examId)}/attempts`, { method: 'POST', body: {} }),
  resumeAttempt: (attemptId) => request(`/cbt/attempts/${encodeURIComponent(attemptId)}`),
  saveAnswer: (attemptId, questionId, optionId) => request(
    `/cbt/attempts/${encodeURIComponent(attemptId)}/answers/${encodeURIComponent(questionId)}`,
    { method: 'PUT', body: { optionId: Number(optionId) } },
  ),
  submitAttempt: (attemptId) => request(`/cbt/attempts/${encodeURIComponent(attemptId)}/submit`, { method: 'POST', body: {} }),
};
