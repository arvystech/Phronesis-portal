const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '/api-proxy'
  : 'https://api.phronesis-sunesis.com.ng';

let csrfToken = null;

async function request(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  const verb = method.toUpperCase();
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(verb)) {
    csrfToken ||= await fetchCsrf();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: verb,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseCsrf = response.headers.get('X-CSRF-Token');
  if (responseCsrf) csrfToken = responseCsrf;
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.message || data?.error || (typeof data === 'string' ? data : '') || response.statusText || 'Request failed');
    error.status = response.status;
    error.code = data?.code;
    error.payload = data;
    throw error;
  }
  return data;
}

async function fetchCsrf() {
  try {
    const response = await fetch(`${API_BASE}/`, { credentials: 'include', headers: { Accept: 'application/json' } });
    const token = response.headers.get('X-CSRF-Token');
    if (token) return token;
    if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) return (await response.json()).csrfToken || null;
  } catch (_) { /* The API may not require CSRF tokens for class-scoped sessions. */ }
  return null;
}

function unwrap(response, keys = []) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data && !Array.isArray(data); depth += 1) {
    for (const key of keys) if (data[key] !== undefined) return data[key];
    if (data.data && typeof data.data === 'object') data = data.data;
    else break;
  }
  return data;
}

export const resultsAPI = {
  listClasses: async () => unwrap(await request('/results/classes'), ['classes', 'items']) || [],
  login: (classId, password) => request('/results/auth/login', { method: 'POST', body: { classId, password } }),
  me: () => request('/results/auth/me'),
  logout: () => request('/results/auth/logout', { method: 'POST', body: {} }),
  listStudents: async (classId) => unwrap(await request(`/results/classes/${encodeURIComponent(classId)}/students`), ['students', 'items']) || [],
  listSubjects: async (classId) => unwrap(await request(`/results/classes/${encodeURIComponent(classId)}/subjects`), ['subjects', 'items']) || [],
  getScores: async (classId, studentId) => unwrap(await request(`/results/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}/scores`), ['result', 'scores']) || [],
  saveScores: (classId, studentId, body) => request(`/results/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}/scores`, { method: 'PUT', body }),
  standings: async (classId) => unwrap(await request(`/results/classes/${encodeURIComponent(classId)}/standings`), ['standings', 'results', 'students', 'items']) || [],
  studentResults: (classId, studentId) => request(`/results/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}/results`),
};

export function records(value, keys = []) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of keys) if (Array.isArray(value[key])) return value[key];
  if (Array.isArray(value.data)) return value.data;
  return [];
}

export function valueOf(record, ...keys) {
  for (const key of keys) if (record?.[key] !== undefined && record[key] !== null) return record[key];
  return '';
}

function responseObject(response) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data?.data && typeof data.data === 'object' && !Array.isArray(data.data); depth += 1) data = data.data;
  return data || {};
}

export function classContext(me) {
  me = responseObject(me);
  const classObject = me?.class && typeof me.class === 'object' ? me.class : me?.assignedClass && typeof me.assignedClass === 'object' ? me.assignedClass : me?.assigned_class && typeof me.assigned_class === 'object' ? me.assigned_class : {};
  const teacher = me?.teacher && typeof me.teacher === 'object' ? me.teacher : me?.assignedTeacher && typeof me.assignedTeacher === 'object' ? me.assignedTeacher : me?.assigned_teacher && typeof me.assigned_teacher === 'object' ? me.assigned_teacher : {};
  const period = me?.period && typeof me.period === 'object' ? me.period : me?.academicPeriod && typeof me.academicPeriod === 'object' ? me.academicPeriod : me?.academic_period && typeof me.academic_period === 'object' ? me.academic_period : {};
  const session = me?.session && typeof me.session === 'object' ? me.session : me?.activeSession && typeof me.activeSession === 'object' ? me.activeSession : me?.active_session && typeof me.active_session === 'object' ? me.active_session : {};
  const term = me?.term && typeof me.term === 'object' ? me.term : me?.activeTerm && typeof me.activeTerm === 'object' ? me.activeTerm : me?.active_term && typeof me.active_term === 'object' ? me.active_term : {};
  return {
    classId: valueOf(me, 'classId', 'class_id', 'assignedClassId', 'assigned_class_id') || valueOf(classObject, 'classId', 'class_id', 'id'),
    className: valueOf(me, 'className', 'class_name') || valueOf(classObject, 'className', 'class_name', 'name'),
    teacherName: valueOf(me, 'teacherName', 'teacher_name') || valueOf(teacher, 'name', 'fullName', 'full_name'),
    sessionId: valueOf(me, 'sessionId', 'session_id', 'activeSessionId', 'active_session_id') || valueOf(period, 'sessionId', 'session_id') || valueOf(session, 'sessionId', 'session_id', 'id'),
    termId: valueOf(me, 'termId', 'term_id', 'activeTermId', 'active_term_id') || valueOf(period, 'termId', 'term_id') || valueOf(term, 'termId', 'term_id', 'id'),
    sessionName: valueOf(me, 'sessionName', 'session_name') || valueOf(session, 'name', 'sessionName', 'session_name'),
    termName: valueOf(me, 'termName', 'term_name') || valueOf(term, 'name', 'termName', 'term_name'),
  };
}

export function requireClass(me) {
  const context = classContext(me);
  if (context.classId === '' || context.classId == null) throw new Error('Your class could not be identified from the teacher session.');
  return context;
}

export function isUnauthorized(error) { return error?.status === 401 || error?.status === 403; }
export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
