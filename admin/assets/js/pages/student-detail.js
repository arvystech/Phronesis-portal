// admin/js/pages/student-detail.js
import { requireAuth } from '../auth.js';
import { setupLayout } from '../layout.js';
import { studentsAPI } from '../api.js';
import { formatCurrency, formatDate, statusColor } from '../helpers.js';

let studentId = null;
let student = null;
let activeTab = 'biodata';

document.addEventListener('DOMContentLoaded', async () => {
  setupLayout('students', 'Student Details');

  const params = new URLSearchParams(window.location.search);
  studentId = params.get('id');
  if (!studentId) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    const nonIdNames = ['students', 'registrations', 'student-detail.html', 'student-details.html', 'student-detail', 'student-details'];
    if (last && !nonIdNames.includes(last.toLowerCase())) {
      studentId = decodeURIComponent(last);
    }
  }

  if (!studentId) {
    studentId = 'std_001';
  }

  await requireAuth(() => {
    initStudentDetail();
  });
});

async function initStudentDetail() {
  bindTabs();
  bindModals();
  bindSubRecordForms();
  await fetchStudent();
}

async function fetchStudent() {
  const loadingEl = document.getElementById('studentDetailLoading');
  const contentEl = document.getElementById('studentDetailContent');

  try {
    loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');

    const res = await studentsAPI.get(studentId);
    student = res.data?.data || null;

    if (!student) {
      window.toast.error('Student not found');
      window.location.href = '/admin/students';
      return;
    }

    renderStudentHeader(student);
    renderBiodata(student);
    renderAcademicAndFeesSidebar(student);
    updateTabsVisibility();

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    // Load active tab data if sub-tab
    loadTabData(activeTab);
  } catch (err) {
    console.error('Failed to load student details:', err);
    window.toast.error('Failed to load student details');
  }
}

function renderStudentHeader(s) {
  document.getElementById('headerFullName').textContent = s.fullName || '—';
  document.getElementById('headerSubInfo').textContent = `${s.registrationNumber || s.admissionNumber || ''} · ${s.class || ''} · ${s.gender || ''}`;
  document.getElementById('headerRegDate').textContent = formatDate(s.registrationDate);
  document.getElementById('headerRegistrar').textContent = s.registeredBy || 'Admin';

  const badgeEl = document.getElementById('headerStatusBadge');
  badgeEl.className = statusColor(s.admissionStatus);
  badgeEl.textContent = s.admissionStatus;

  // Passports
  const studentPic = document.getElementById('headerStudentPassport');
  studentPic.src = s.studentPassport || '/admin/assets/images/avatars/default_student.png';
  studentPic.onerror = () => { studentPic.src = '/admin/assets/images/avatars/default_student.png'; };

  const guardianPic = document.getElementById('headerGuardianPassport');
  guardianPic.src = s.guardianPassport || '/admin/assets/images/avatars/default_parent.svg';
  guardianPic.onerror = () => { guardianPic.src = '/admin/assets/images/avatars/default_parent.svg'; };

  // Status buttons
  const statusContainer = document.getElementById('headerStatusButtons');
  const statuses = ['Pending', 'Approved', 'Admitted', 'Rejected'].filter(st => st !== s.admissionStatus);
  statusContainer.innerHTML = statuses.map(st => `
    <button onclick="window.updateStatus('${st}')" class="btn-secondary text-[10px] px-3 py-2 font-bold hover:border-royal hover:text-royal uppercase transition-all">
      Mark as ${st}
    </button>
  `).join('');
}

window.updateStatus = async function (newStatus) {
  try {
    await studentsAPI.updateStatus(studentId, newStatus);
    window.toast.success(`Status updated to ${newStatus}`);
    await fetchStudent();
  } catch (err) {
    console.error(err);
    window.toast.error('Failed to update status');
  }
};

function renderBiodata(s) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  };

  setVal('bioFullName', s.fullName);
  setVal('bioDob', formatDate(s.dateOfBirth));
  setVal('bioAge', s.age ? `${s.age} Years` : '—');
  setVal('bioGender', s.gender);
  setVal('bioBloodGroup', s.bloodGroup);
  setVal('bioReligion', s.religion);
  setVal('bioNationality', s.nationality);
  setVal('bioMotherTongue', s.motherTongue);
  setVal('bioPhone', s.studentPhone);
  setVal('bioEmail', s.studentEmail);
  setVal('bioState', s.stateOfOrigin);
  setVal('bioLga', s.localGovernment);
  setVal('bioPrevSchool', s.previousSchool);
  setVal('bioAddress', s.homeAddress);
  setVal('bioHealth', s.healthCondition);

  // Parents
  setVal('bioParentName', s.parentName);
  setVal('bioParentOccupation', s.parentOccupation);
  setVal('bioParentPhone', s.parentPhone);
  setVal('bioParentEmail', s.parentEmail);
  setVal('bioEmergencyContact', s.emergencyContact);
  setVal('bioEmergencyPhone', s.emergencyPhone);
  setVal('bioGuardianName', s.guardianName);
  setVal('bioGuardianPhone', s.guardianPhone);
  setVal('bioGuardianRel', s.guardianRelationship);
}

function renderAcademicAndFeesSidebar(s) {
  const balance = parseFloat(s.balance || 0);

  document.getElementById('sideClass').textContent = s.class || '—';
  document.getElementById('sideArm').textContent = s.arm || 'Gold';
  document.getElementById('sideSession').textContent = s.academicSession || '2025/2026';

  document.getElementById('sideRegFee').textContent = formatCurrency(s.registrationFee || 15000);
  document.getElementById('sideAmountPaid').textContent = formatCurrency(s.amountPaid || 0);
  document.getElementById('sideBalance').textContent = formatCurrency(balance);
  document.getElementById('sideBalance').className = `text-sm font-bold ${balance > 0 ? 'text-red-500' : 'text-emerald-600'}`;
}

function updateTabsVisibility() {
  const isEnrolled = student?.admissionStatus === 'Approved' || student?.admissionStatus === 'Admitted';
  const subTabs = document.querySelectorAll('.enrolled-only-tab');
  subTabs.forEach(tab => tab.classList.toggle('hidden', !isEnrolled));
}

function bindTabs() {
  const tabs = document.querySelectorAll('[data-tab-btn]');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab-btn');
      activeTab = target;

      tabs.forEach(b => {
        if (b.getAttribute('data-tab-btn') === target) {
          b.className = 'px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 border-gold text-royal font-black transition-all';
        } else {
          b.className = 'px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-text-soft hover:text-royal transition-all';
        }
      });

      document.querySelectorAll('[data-tab-pane]').forEach(pane => {
        pane.classList.toggle('hidden', pane.getAttribute('data-tab-pane') !== target);
      });

      loadTabData(target);
    });
  });
}

async function loadTabData(tabName) {
  if (!student) return;

  if (tabName === 'attendance') {
    loadAttendance();
  } else if (tabName === 'results') {
    loadResults();
  } else if (tabName === 'payments') {
    loadPayments();
  } else if (tabName === 'behaviors') {
    loadBehaviors();
  }
}

// Sub-record loaders
async function loadAttendance() {
  try {
    const res = await studentsAPI.getAttendance(studentId);
    const list = res.data?.data || [];
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-text-soft text-xs">No attendance recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr class="hover:bg-warm-white/60">
        <td class="px-4 py-2.5 text-xs font-medium">${formatDate(item.date)}</td>
        <td class="px-4 py-2.5">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
            item.status === 'Present' ? 'bg-emerald-100 text-emerald-700' :
            item.status === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }">${item.status}</span>
        </td>
        <td class="px-4 py-2.5 text-xs text-text-soft">${item.remarks || '—'}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function loadResults() {
  try {
    const res = await studentsAPI.getResults(studentId);
    const list = res.data?.data || [];
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-text-soft text-xs">No academic grades recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr class="hover:bg-warm-white/60">
        <td class="px-4 py-2.5 text-xs font-bold text-royal">${item.subject}</td>
        <td class="px-4 py-2.5 text-xs font-mono">${item.ca_score ?? item.caScore ?? '—'}</td>
        <td class="px-4 py-2.5 text-xs font-mono">${item.exam_score ?? item.examScore ?? '—'}</td>
        <td class="px-4 py-2.5 text-xs font-bold font-mono">${item.total_score ?? item.totalScore ?? '—'}</td>
        <td class="px-4 py-2.5 text-xs font-bold text-emerald-700">${item.grade || '—'}</td>
        <td class="px-4 py-2.5 text-xs text-text-soft">${item.remarks || item.term || '—'}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function loadPayments() {
  try {
    const res = await studentsAPI.getPayments(studentId);
    const list = res.data?.data || [];
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-text-soft text-xs">No payment records logged yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr class="hover:bg-warm-white/60">
        <td class="px-4 py-2.5 text-xs font-mono font-bold">${item.receipt_no || item.receiptNo || '—'}</td>
        <td class="px-4 py-2.5 text-xs font-semibold text-text-dark">${item.payment_type || item.paymentType || 'Tuition'}</td>
        <td class="px-4 py-2.5 text-xs text-text-soft">${formatDate(item.payment_date || item.date)}</td>
        <td class="px-4 py-2.5 text-xs font-bold text-emerald-600">${formatCurrency(item.amount)}</td>
        <td class="px-4 py-2.5 text-xs text-text-soft">${item.payment_method || item.paymentMethod || 'Cash'}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function loadBehaviors() {
  try {
    const res = await studentsAPI.getBehaviors(studentId);
    const list = res.data?.data || [];
    const tbody = document.getElementById('behaviorsTableBody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-text-soft text-xs">No behavioral entries found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr class="hover:bg-warm-white/60">
        <td class="px-4 py-2.5 text-xs font-medium">${formatDate(item.incident_date || item.date)}</td>
        <td class="px-4 py-2.5">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
            (item.incident_type || item.incidentType) === 'Commendation' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }">${item.incident_type || item.incidentType}</span>
        </td>
        <td class="px-4 py-2.5 text-xs text-text-dark">${item.description || '—'}</td>
        <td class="px-4 py-2.5 text-xs text-text-soft">${item.action_taken || item.actionTaken || '—'}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

function bindSubRecordForms() {
  // Attendance Form
  const attForm = document.getElementById('addAttendanceForm');
  if (attForm) {
    attForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        date: document.getElementById('attDate').value,
        status: document.getElementById('attStatus').value,
        remarks: document.getElementById('attRemarks').value,
      };
      try {
        await studentsAPI.addAttendance(studentId, payload);
        window.toast.success('Attendance logged');
        attForm.reset();
        document.getElementById('attDate').value = new Date().toISOString().split('T')[0];
        loadAttendance();
      } catch {
        window.toast.error('Failed to log attendance');
      }
    });
  }

  // Result Form
  const resForm = document.getElementById('addResultForm');
  if (resForm) {
    resForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        subject: document.getElementById('resSubject').value,
        caScore: document.getElementById('resCaScore').value,
        examScore: document.getElementById('resExamScore').value,
        term: document.getElementById('resTerm').value,
        academicSession: '2025/2026',
      };
      try {
        await studentsAPI.addResult(studentId, payload);
        window.toast.success('Grade recorded successfully');
        resForm.reset();
        loadResults();
      } catch {
        window.toast.error('Failed to save grade');
      }
    });
  }

  // Payment Form
  const payForm = document.getElementById('addPaymentForm');
  if (payForm) {
    payForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        amount: document.getElementById('payAmount').value,
        date: document.getElementById('payDate').value,
        paymentType: document.getElementById('payType').value,
        paymentMethod: document.getElementById('payMethod').value,
        receiptNo: document.getElementById('payReceipt').value || `REC-${Date.now().toString().slice(-6)}`,
      };
      try {
        await studentsAPI.addPayment(studentId, payload);
        window.toast.success('Payment registered successfully');
        payForm.reset();
        document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('payReceipt').value = `REC-${Date.now().toString().slice(-6)}`;
        await fetchStudent();
        loadPayments();
      } catch (err) {
        window.toast.error(err.response?.data?.message || 'Failed to record payment');
      }
    });
  }

  // Behavior Form
  const behForm = document.getElementById('addBehaviorForm');
  if (behForm) {
    behForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        date: document.getElementById('behDate').value,
        incidentType: document.getElementById('behType').value,
        description: document.getElementById('behDesc').value,
        actionTaken: document.getElementById('behAction').value,
      };
      try {
        await studentsAPI.addBehavior(studentId, payload);
        window.toast.success('Behavior entry logged');
        behForm.reset();
        document.getElementById('behDate').value = new Date().toISOString().split('T')[0];
        loadBehaviors();
      } catch {
        window.toast.error('Failed to log behavior');
      }
    });
  }
}

function bindModals() {
  // Transfer modal
  const transferBtn = document.getElementById('openTransferBtn');
  const transferModal = document.getElementById('transferModal');
  const closeTransfer = document.getElementById('closeTransferModal');
  const transferForm = document.getElementById('transferForm');

  if (transferBtn && transferModal) {
    transferBtn.addEventListener('click', () => transferModal.classList.remove('hidden'));
    closeTransfer?.addEventListener('click', () => transferModal.classList.add('hidden'));

    transferForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        targetClass: document.getElementById('transferClass').value,
        targetArm: document.getElementById('transferArm').value,
        targetSession: '2025/2026',
      };
      try {
        await studentsAPI.transfer(studentId, payload);
        window.toast.success('Class transfer completed');
        transferModal.classList.add('hidden');
        await fetchStudent();
      } catch {
        window.toast.error('Failed to execute transfer');
      }
    });
  }

  // Promote modal
  const promoteBtn = document.getElementById('openPromoteBtn');
  const promoteModal = document.getElementById('promoteModal');
  const closePromote = document.getElementById('closePromoteModal');
  const promoteForm = document.getElementById('promoteForm');

  if (promoteBtn && promoteModal) {
    promoteBtn.addEventListener('click', () => promoteModal.classList.remove('hidden'));
    closePromote?.addEventListener('click', () => promoteModal.classList.add('hidden'));

    promoteForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        nextClass: document.getElementById('promoteClass').value,
        targetArm: document.getElementById('promoteArm').value,
        targetSession: '2025/2026',
      };
      try {
        await studentsAPI.promote(studentId, payload);
        window.toast.success('Student promoted successfully');
        promoteModal.classList.add('hidden');
        await fetchStudent();
      } catch {
        window.toast.error('Failed to execute promotion');
      }
    });
  }
}
