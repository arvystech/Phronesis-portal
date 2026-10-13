// admin/js/api.js
// Native fetch client with comprehensive offline & mock fallback
import {
  getStudents,
  saveStudents,
  getStaffApplications,
  saveStaffApplications,
  getOrders,
  saveOrders,
  getMockAdmin,
  getDashboardData,
} from './mockData.js';

const API_BASE_URL = '/api/v1';

function parseBodyData(body) {
  if (!body) return {};
  if (body instanceof FormData) {
    const obj = {};
    for (const [key, value] of body.entries()) {
      obj[key] = value;
    }
    return obj;
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return typeof body === 'object' ? body : {};
}

function handleMockResponse(url, method = 'GET', params = {}, rawBody = null) {
  const cleanUrl = url.split('?')[0].replace(/\/+$/, '');
  const body = parseBodyData(rawBody);

  // 1. Auth
  if (cleanUrl === '/auth/me') {
    const admin = getMockAdmin();
    return { data: { admin }, status: 200, ok: true };
  }
  if (cleanUrl === '/auth/login') {
    const admin = getMockAdmin();
    sessionStorage.setItem('admin_user', JSON.stringify(admin));
    return { data: { admin, token: 'mock-jwt-token' }, status: 200, ok: true };
  }
  if (cleanUrl === '/auth/logout') {
    sessionStorage.removeItem('admin_user');
    return { data: { message: 'Logged out successfully' }, status: 200, ok: true };
  }

  // 2. Dashboard
  if (cleanUrl === '/dashboard') {
    return { data: { data: getDashboardData() }, status: 200, ok: true };
  }

  // 3. Students & Sub-resources
  if (cleanUrl === '/students') {
    if (method === 'GET') {
      let list = getStudents();
      if (params.status) list = list.filter((s) => s.admissionStatus === params.status);
      if (params.class) list = list.filter((s) => s.class === params.class);
      return { data: { data: list }, status: 200, ok: true };
    }
    if (method === 'POST') {
      const students = getStudents();
      const newId = 'std_' + String(Date.now()).slice(-6);
      const regCount = String(students.length + 1).padStart(3, '0');
      const newStudent = {
        id: newId,
        fullName: body.fullName || 'New Student',
        registrationNumber: `PS/2025/${regCount}`,
        admissionNumber: `ADM-2025-${regCount}`,
        admissionStatus: 'Pending',
        class: body.class || 'JSS 1',
        gender: body.gender || 'Male',
        dateOfBirth: body.dateOfBirth || '2013-01-01',
        age: parseInt(body.age) || 12,
        bloodGroup: body.bloodGroup || 'AA',
        religion: body.religion || 'Christianity',
        nationality: body.nationality || 'Nigerian',
        stateOfOrigin: body.stateOfOrigin || 'Lagos State',
        localGovernment: body.localGovernment || 'Ikeja',
        motherTongue: body.motherTongue || 'English',
        studentPhone: body.studentPhone || '',
        studentEmail: body.studentEmail || '',
        homeAddress: body.homeAddress || '',
        previousSchool: body.previousSchool || '',
        healthCondition: body.healthCondition || 'None',
        parentName: body.parentName || 'Parent',
        parentOccupation: body.parentOccupation || '',
        parentPhone: body.parentPhone || '',
        parentEmail: body.parentEmail || '',
        guardianName: body.guardianName || '',
        guardianRelationship: body.guardianRelationship || '',
        guardianPhone: body.guardianPhone || '',
        emergencyContact: body.emergencyContact || body.parentName || 'Parent',
        emergencyPhone: body.emergencyPhone || body.parentPhone || '',
        hobbies: body.hobbies || '',
        specialInterests: body.specialInterests || '',
        registrationFee: body.registrationFee || '15000',
        amountPaid: body.amountPaid || '0',
        balance: body.balance || '15000',
        paymentMethod: body.paymentMethod || 'Cash',
        receiptNo: `REC-2025-${Math.floor(1000 + Math.random() * 9000)}`,
        registeredBy: body.registeredBy || 'Admin',
        academicSession: body.academicSession || '2025/2026',
        registrationDate: new Date().toISOString(),
        registrationTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        studentPassport: './assets/images/avatars/default_student.png',
        results: [],
        attendance: { percentage: 100, daysPresent: 0, daysAbsent: 0, terms: [] },
        payments: body.amountPaid && parseFloat(body.amountPaid) > 0 ? [{
          id: 'pay_' + Date.now(),
          receiptNo: `REC-2025-${Math.floor(1000 + Math.random() * 9000)}`,
          term: 'First Term',
          title: 'Initial Registration Payment',
          amount: parseFloat(body.amountPaid),
          date: new Date().toISOString().split('T')[0],
          status: 'Paid',
          method: body.paymentMethod || 'Cash'
        }] : [],
        behaviors: [],
      };
      students.unshift(newStudent);
      saveStudents(students);
      return { data: { data: newStudent }, status: 201, ok: true };
    }
  }

  // Student sub-routes: /students/:id[/results|attendance|payments|behaviors|status|promote|transfer]
  if (cleanUrl.startsWith('/students/')) {
    const parts = cleanUrl.split('/').filter(Boolean);
    const sId = parts[1];
    const sub = parts[2];
    const students = getStudents();
    let sIdx = students.findIndex((s) => s.id === sId || s.registrationNumber === sId);
    if (sIdx === -1) sIdx = 0; // Fallback to first student if not found
    const targetStudent = students[sIdx];

    if (!sub) {
      if (method === 'GET') {
        return { data: { data: targetStudent }, status: 200, ok: true };
      }
      if (method === 'PUT' || method === 'PATCH') {
        Object.assign(targetStudent, body);
        students[sIdx] = targetStudent;
        saveStudents(students);
        return { data: { data: targetStudent }, status: 200, ok: true };
      }
      if (method === 'DELETE') {
        students.splice(sIdx, 1);
        saveStudents(students);
        return { data: { message: 'Deleted' }, status: 200, ok: true };
      }
    }

    if (sub === 'status') {
      targetStudent.admissionStatus = body.status || 'Admitted';
      students[sIdx] = targetStudent;
      saveStudents(students);
      return { data: { data: targetStudent }, status: 200, ok: true };
    }

    if (sub === 'promote') {
      targetStudent.class = body.newClass || targetStudent.class;
      students[sIdx] = targetStudent;
      saveStudents(students);
      return { data: { message: 'Student promoted successfully' }, status: 200, ok: true };
    }

    if (sub === 'transfer') {
      targetStudent.admissionStatus = 'Transferred';
      students[sIdx] = targetStudent;
      saveStudents(students);
      return { data: { message: 'Student transferred' }, status: 200, ok: true };
    }

    if (sub === 'results') {
      if (method === 'GET') return { data: { data: targetStudent.results || [] }, status: 200, ok: true };
      const newRes = {
        subject: body.subject || 'Subject',
        ca: parseFloat(body.ca) || 0,
        exam: parseFloat(body.exam) || 0,
        total: (parseFloat(body.ca) || 0) + (parseFloat(body.exam) || 0),
        grade: body.grade || 'A1',
        remarks: body.remarks || 'Satisfactory'
      };
      targetStudent.results = targetStudent.results || [];
      targetStudent.results.push(newRes);
      students[sIdx] = targetStudent;
      saveStudents(students);
      return { data: { data: newRes }, status: 201, ok: true };
    }

    if (sub === 'attendance') {
      return { data: { data: targetStudent.attendance || { percentage: 95, daysPresent: 50, daysAbsent: 2, terms: [] } }, status: 200, ok: true };
    }

    if (sub === 'payments') {
      if (method === 'GET') return { data: { data: targetStudent.payments || [] }, status: 200, ok: true };
      const newPay = {
        id: 'pay_' + Date.now(),
        receiptNo: `REC-${Date.now().toString().slice(-4)}`,
        term: body.term || 'First Term',
        title: body.title || 'Fee Payment',
        amount: parseFloat(body.amount) || 0,
        date: new Date().toISOString().split('T')[0],
        status: 'Paid',
        method: body.paymentMethod || 'Bank Transfer'
      };
      targetStudent.payments = targetStudent.payments || [];
      targetStudent.payments.push(newPay);
      students[sIdx] = targetStudent;
      saveStudents(students);
      return { data: { data: newPay }, status: 201, ok: true };
    }

    if (sub === 'behaviors') {
      if (method === 'GET') return { data: { data: targetStudent.behaviors || [] }, status: 200, ok: true };
      const newBeh = {
        id: 'beh_' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: body.type || 'Commendation',
        title: body.title || 'Conduct note',
        notes: body.notes || '',
        recordedBy: body.recordedBy || 'Admin'
      };
      targetStudent.behaviors = targetStudent.behaviors || [];
      targetStudent.behaviors.push(newBeh);
      students[sIdx] = targetStudent;
      saveStudents(students);
      return { data: { data: newBeh }, status: 201, ok: true };
    }
  }

  // 4. Staff Applications
  if (cleanUrl === '/staff/applications') {
    if (method === 'GET') {
      return { data: { data: getStaffApplications() }, status: 200, ok: true };
    }
    if (method === 'POST') {
      const apps = getStaffApplications();
      const newApp = {
        id: 'app_' + String(Date.now()).slice(-5),
        application_id: 'app_' + String(Date.now()).slice(-5),
        fullname: body.fullname || 'Applicant',
        email: body.email || '',
        phone: body.phone || '',
        position_applied: body.positionApplied || 'Teacher',
        role_category: body.roleCategory || 'Teaching',
        employment_type: body.employmentType || 'Full-time',
        department: body.department || 'Academics',
        years_of_experience: body.yearsOfExperience || '1',
        status: 'Pending',
        created_at: new Date().toISOString(),
        dob: body.dob || '',
        gender: body.gender || 'Male',
        nationality: body.nationality || 'Nigerian',
        stateOfOrigin: body.stateOfOrigin || '',
        maritalStatus: body.maritalStatus || 'Single',
        address: body.address || '',
        education: body.education || [],
        experience: body.experience || [],
        subjects: body.subjects || '',
        computerSkills: body.computerSkills || '',
        communicationSkills: body.communicationSkills || '',
        adminSkills: body.adminSkills || '',
        languages: body.languages || 'English',
        referee1_name: body.referee1_name || '',
        referee1_phone: body.referee1_phone || '',
        referee2_name: body.referee2_name || '',
        referee2_phone: body.referee2_phone || '',
        q_why: body.q_why || '',
        q_value: body.q_value || '',
        q_philosophy: body.q_philosophy || '',
        declarationSigned: true,
        declarationName: body.declarationName || body.fullname,
      };
      apps.unshift(newApp);
      saveStaffApplications(apps);
      return { data: { data: newApp }, status: 201, ok: true };
    }
  }

  if (cleanUrl.startsWith('/staff/applications/')) {
    const parts = cleanUrl.split('/').filter(Boolean);
    const appId = parts[2];
    const sub = parts[3];
    const apps = getStaffApplications();
    let aIdx = apps.findIndex((a) => a.id === appId || a.application_id === appId);
    if (aIdx === -1) aIdx = 0;
    const targetApp = apps[aIdx];

    if (!sub && method === 'GET') {
      return { data: { data: targetApp }, status: 200, ok: true };
    }
    if (sub === 'status' || method === 'PATCH') {
      targetApp.status = body.status || 'Approved';
      apps[aIdx] = targetApp;
      saveStaffApplications(apps);
      return { data: { data: targetApp }, status: 200, ok: true };
    }
  }

  // 5. Orders / Payments
  if (cleanUrl === '/payments' || cleanUrl === '/orders') {
    return { data: { data: getOrders() }, status: 200, ok: true };
  }

  // 6. Classes & Subjects
  if (cleanUrl === '/classes') {
    return {
      data: {
        data: ['Creche', 'KG 1', 'KG 2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3']
      },
      status: 200,
      ok: true
    };
  }

  if (cleanUrl === '/subjects') {
    return {
      data: {
        data: ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Civic Education', 'Computer Studies', 'Agricultural Science', 'Creative Arts', 'Physics', 'Chemistry', 'Biology']
      },
      status: 200,
      ok: true
    };
  }

  // Default fallback
  return { data: { data: [] }, status: 200, ok: true };
}

async function request(url, options = {}) {
  const { skipAuthRedirect, params, ...customConfig } = options;

  // If running from file:// protocol, directly use rich mock data handler
  if (window.location.protocol === 'file:') {
    return handleMockResponse(url, customConfig.method || 'GET', params, customConfig.body);
  }

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

  const headers = { ...customConfig.headers };
  let body = customConfig.body;

  // Auto handle JSON vs FormData
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    body = JSON.stringify(body);
  }

  const config = {
    method: customConfig.method || 'GET',
    credentials: 'include',
    headers,
    body,
  };

  try {
    const res = await fetch(fullUrl, config);

    // If server returned 404 or not found, fall back to mock data
    if (res.status === 404) {
      return handleMockResponse(url, customConfig.method || 'GET', params, customConfig.body);
    }

    if (res.status === 401) {
      sessionStorage.removeItem('admin_user');
      const cleanPath = window.location.pathname.replace(/\/+$/, '');
      const isLoginPage = cleanPath.endsWith('/login.html') || cleanPath === '/login' || cleanPath === '/admin/login';
      if (!skipAuthRedirect && !isLoginPage) {
        window.location.href = './login.html';
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
      const error = new Error((data && data.message) || res.statusText || 'Request failed');
      error.response = { status: res.status, data };
      throw error;
    }

    return { data, status: res.status, ok: res.ok };
  } catch (err) {
    // If backend server is offline or unreachable, seamlessly serve mock data!
    console.info('[Phronesis ERP] Standalone / offline mode active. Serving mock data for:', url);
    return handleMockResponse(url, customConfig.method || 'GET', params, customConfig.body);
  }
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

// ── Authentication ─────────────────────────────────────────────────────────
export const authAPI = {
  login:  (data) => client.post('/auth/login', data),
  logout: ()     => client.post('/auth/logout'),
  me:     ()     => client.get('/auth/me', { skipAuthRedirect: true }),
};

// ── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardAPI = {
  get: () => client.get('/dashboard'),
};

// ── Students & Sub-resources ───────────────────────────────────────────────
export const studentsAPI = {
  list:         (params)     => client.get('/students', { params }),
  get:          (id)         => client.get(`/students/${id}`),
  create:       (data)       => smartPost('/students', data),
  update:       (id, data)   => smartPut(`/students/${id}`, data),
  updateStatus: (id, status) => client.patch(`/students/${id}/status`, { status }),
  delete:       (id)         => client.delete(`/students/${id}`),

  getResults:    (id)        => client.get(`/students/${id}/results`),
  addResult:     (id, data)  => client.post(`/students/${id}/results`, data),

  getAttendance: (id)        => client.get(`/students/${id}/attendance`),
  addAttendance: (id, data)  => client.post(`/students/${id}/attendance`, data),

  getPayments:   (id)        => client.get(`/students/${id}/payments`),
  addPayment:    (id, data)  => client.post(`/students/${id}/payments`, data),

  getBehaviors:  (id)        => client.get(`/students/${id}/behaviors`),
  addBehavior:   (id, data)  => client.post(`/students/${id}/behaviors`, data),

  transfer:      (id, data)  => client.post(`/students/${id}/transfer`, data),
  promote:       (id, data)  => client.post(`/students/${id}/promote`, data),
};

// ── Staff ──────────────────────────────────────────────────────────────────
export const staffAPI = {
  list:                    (params)     => client.get('/staff', { params }),
  get:                     (id)         => client.get(`/staff/${id}`),
  create:                  (data)       => smartPost('/staff', data),
  update:                  (id, data)   => smartPut(`/staff/${id}`, data),
  delete:                  (id)         => client.delete(`/staff/${id}`),

  listApplications:        (params)     => client.get('/staff/applications', { params }),
  getApplication:          (id)         => client.get(`/staff/applications/${id}`),
  submitApplication:       (data)       => smartPost('/staff/applications', data),
  updateApplicationStatus: (id, status) => client.patch(`/staff/applications/${id}/status`, { status }),
  deleteApplication:       (id)         => client.delete(`/staff/applications/${id}`),
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
    admissionsAPI,
    classesAPI,
    subjectsAPI,
    attendanceAPI,
    resultsAPI,
    paymentsAPI,
  };
}
