import { resultsAPI, classContext, isUnauthorized, valueOf } from './api.js';

export async function getPortalContext() {
  try {
    const context = classContext(await resultsAPI.me());
    if (context.classId === '' || context.classId == null) throw new Error('Your teacher session does not include an assigned class.');
    return context;
  } catch (error) {
    if (isUnauthorized(error)) window.location.replace('/results');
    throw error;
  }
}

export async function signOut() {
  try { await resultsAPI.logout(); } catch (_) { /* Redirect even if the session already expired. */ }
  window.location.replace('/results');
}

export function studentId(student) { return valueOf(student, 'studentId', 'student_id', 'id'); }
export function admissionNumber(student) { return valueOf(student, 'admissionNumber', 'admission_number', 'registrationNumber', 'registration_number'); }
export function studentName(student) {
  return valueOf(student, 'fullName', 'full_name', 'studentName', 'student_name') ||
    [valueOf(student, 'firstName', 'first_name'), valueOf(student, 'middleName', 'middle_name'), valueOf(student, 'lastName', 'last_name')].filter(Boolean).join(' ');
}
export function subjectId(subject) { return valueOf(subject, 'subjectId', 'subject_id', 'id'); }
export function subjectName(subject) { return valueOf(subject, 'subjectName', 'subject_name', 'name', 'title'); }

export function extractRows(response, keys) {
  let data = response?.data ?? response;
  for (let depth = 0; depth < 4 && data && !Array.isArray(data); depth += 1) {
    for (const key of keys) if (Array.isArray(data[key])) return data[key];
    if (data.data && typeof data.data === 'object') data = data.data;
    else break;
  }
  return Array.isArray(data) ? data : [];
}

export function errorMessage(error, fallback) {
  if (isUnauthorized(error)) return 'Your session has expired. Please sign in again.';
  return error?.message || fallback;
}
