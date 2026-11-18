import { getAuthToken } from './auth.js';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '/api-proxy'
  : 'https://api.phronesis-sunesis.com.ng';
let csrfToken = null;

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const token = getAuthToken();
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
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
  const headerToken = response.headers.get('X-CSRF-Token');
  if (headerToken) csrfToken = headerToken;
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
    const fromHeader = response.headers.get('X-CSRF-Token');
    if (fromHeader) return fromHeader;
    if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) {
      return (await response.json()).csrfToken || null;
    }
  } catch (_) { /* The API may support bearer-authenticated CSRF bypass. */ }
  return null;
}

export const cbtAdminAPI = {
  listStudents: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    return request(`/admin/cbt/students${query.size ? `?${query}` : ''}`);
  },
  getStudentResults: (studentId) => request(`/admin/cbt/students/${encodeURIComponent(studentId)}/results`),
  getAttemptReview: (attemptId) => request(`/admin/cbt/attempts/${encodeURIComponent(attemptId)}/review`),
  resetAttempt: (attemptId) => request(`/admin/cbt/attempts/${encodeURIComponent(attemptId)}/reset`, { method: 'POST', body: {} }),
  listExams: (params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    return request(`/admin/cbt/exams${query.size ? `?${query}` : ''}`);
  },
  createExam: (body) => request('/admin/cbt/exams', { method: 'POST', body }),
  getExam: (id) => request(`/admin/cbt/exams/${encodeURIComponent(id)}`),
  updateExam: (id, body) => request(`/admin/cbt/exams/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  publishExam: (id) => request(`/admin/cbt/exams/${encodeURIComponent(id)}/publish`, { method: 'POST', body: {} }),
  closeExam: (id) => request(`/admin/cbt/exams/${encodeURIComponent(id)}/close`, { method: 'POST', body: {} }),
  archiveExam: (id) => request(`/admin/cbt/exams/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listAttempts: (id) => request(`/admin/cbt/exams/${encodeURIComponent(id)}/attempts`),
};

export const cbtStudentAPI = {
  listExams: () => request('/student/cbt/exams'),
  startAttempt: (examId) => request(`/student/cbt/exams/${encodeURIComponent(examId)}/attempts`, { method: 'POST', body: {} }),
  resumeAttempt: (attemptId) => request(`/student/cbt/attempts/${encodeURIComponent(attemptId)}`),
  saveAnswer: (attemptId, questionId, optionId) => request(
    `/student/cbt/attempts/${encodeURIComponent(attemptId)}/answers/${encodeURIComponent(questionId)}`,
    { method: 'PUT', body: { optionId: Number(optionId) } },
  ),
  submitAttempt: (attemptId) => request(`/student/cbt/attempts/${encodeURIComponent(attemptId)}/submit`, { method: 'POST', body: {} }),
};
