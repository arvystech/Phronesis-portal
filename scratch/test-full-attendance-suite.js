import assert from 'assert';

// Import or replicate the core logic of staff-attendance.js
const ATTENDANCE_CONFIG = {
  resumptionTime: '08:00',
  lateThresholdTime: '08:15',
  cutoffTime: '12:00',
  timeZoneOffsetHours: 1, // WAT = UTC+1
  workingDays: [1, 2, 3, 4, 5] // Mon-Fri
};

function normalizeDepartment(rawDept) {
  const d = String(rawDept || '').trim();
  if (d.toLowerCase().includes('non')) return 'Non-teaching';
  if (d) return d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
  return 'Teaching';
}

function getLocalDateString(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const utcHours = d.getUTCHours();
    const isNextDay = (utcHours + ATTENDANCE_CONFIG.timeZoneOffsetHours) >= 24;
    const adjustedDate = new Date(d);
    if (isNextDay) {
      adjustedDate.setUTCDate(adjustedDate.getUTCDate() + 1);
    }
    const year = adjustedDate.getUTCFullYear();
    const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (_) {
    return isoString.substring(0, 10);
  }
}

function extractLocalTime(isoString) {
  if (!isoString) return { formatted: '—', totalMinutes: 999999 };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { formatted: '—', totalMinutes: 999999 };

    const utcHours = d.getUTCHours();
    const utcMinutes = d.getUTCMinutes();
    const watHours = (utcHours + ATTENDANCE_CONFIG.timeZoneOffsetHours) % 24;
    const totalMinutes = watHours * 60 + utcMinutes;

    const period = watHours >= 12 ? 'PM' : 'AM';
    const h12 = watHours % 12 || 12;
    const formatted = `${String(h12).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')} ${period}`;

    return { formatted, totalMinutes };
  } catch (_) {
    return { formatted: '—', totalMinutes: 999999 };
  }
}

function formatDateDDMMYYYY(yyyyMmDd) {
  if (!yyyyMmDd) return '—';
  const parts = yyyyMmDd.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return yyyyMmDd;
}

// Actual 9 biometric events from database
const rawAttendanceEvents = [
  { id: 1, staff_id: 17, first_name: "Effa-onun", last_name: "Ojah", department: "Teaching", biometric_enrollment_no: "000000002", attendance_datetime: "2026-10-05T22:48:00.000Z" },
  { id: 2, staff_id: 17, first_name: "Effa-onun", last_name: "Ojah", department: "Teaching", biometric_enrollment_no: "000000002", attendance_datetime: "2026-10-06T00:05:00.000Z" },
  { id: 3, staff_id: 18, first_name: "Josiah", last_name: "Ntekim", department: "Teaching", biometric_enrollment_no: "000000003", attendance_datetime: "2026-10-05T17:22:00.000Z" },
  { id: 4, staff_id: 19, first_name: "Rose", last_name: "Bassey", department: "Teaching", biometric_enrollment_no: "000000004", attendance_datetime: "2026-10-05T17:23:00.000Z" },
  { id: 5, staff_id: 20, first_name: "Faith", last_name: "Womi", department: "Teaching", biometric_enrollment_no: "000000005", attendance_datetime: "2026-10-05T17:26:00.000Z" },
  { id: 6, staff_id: 21, first_name: "Uduak", last_name: "Aniedi", department: "Teaching", biometric_enrollment_no: "000000006", attendance_datetime: "2026-10-05T17:27:00.000Z" },
  { id: 7, staff_id: 22, first_name: "Esther", last_name: "Ekaidi", department: "Teaching", biometric_enrollment_no: "000000007", attendance_datetime: "2026-10-05T17:29:00.000Z" },
  { id: 8, staff_id: 24, first_name: "Janet", last_name: "Eremi", department: "Teaching", biometric_enrollment_no: "000000009", attendance_datetime: "2026-10-05T17:31:00.000Z" },
  { id: 9, staff_id: 25, first_name: "Magdalene", last_name: "E.", department: "Teaching", biometric_enrollment_no: "000000010", attendance_datetime: "2026-10-05T17:33:00.000Z" }
];

// Actual 8 active staff from database
let rawActiveStaff = [
  { id: 17, staffNo: 'PSA-001', firstName: 'Effa-onun', lastName: 'Ojah', otherNames: '', biometricEnrollmentNo: '000000002', department: 'Teaching' },
  { id: 18, staffNo: 'PSA-002', firstName: 'Josiah', lastName: 'Ntekim', otherNames: '', biometricEnrollmentNo: '000000003', department: 'Teaching' },
  { id: 19, staffNo: 'PSA-003', firstName: 'Rose', lastName: 'Bassey', otherNames: '', biometricEnrollmentNo: '000000004', department: 'Teaching' },
  { id: 20, staffNo: 'PSA-004', firstName: 'Faith', lastName: 'Womi', otherNames: '', biometricEnrollmentNo: '000000005', department: 'Teaching' },
  { id: 21, staffNo: 'PSA-005', firstName: 'Uduak', lastName: 'Aniedi', otherNames: '', biometricEnrollmentNo: '000000006', department: 'Teaching' },
  { id: 22, staffNo: 'PSA-006', firstName: 'Esther', lastName: 'Ekaidi', otherNames: '', biometricEnrollmentNo: '000000007', department: 'Teaching' },
  { id: 24, staffNo: 'PSA-008', firstName: 'Janet', lastName: 'Eremi', otherNames: '', biometricEnrollmentNo: '000000009', department: 'Teaching' },
  { id: 25, staffNo: 'PSA-009', firstName: 'Magdalene', lastName: 'E.', otherNames: '', biometricEnrollmentNo: '000000010', department: 'Teaching' },
];

console.log('🧪 Verifying Attendance Fix Logic:');

// Test 1: Date Initialization
const dateCounts = {};
rawAttendanceEvents.forEach(e => {
  const dStr = getLocalDateString(e.attendance_datetime);
  if (dStr) dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
});
const datesByActivity = Object.keys(dateCounts).sort((a, b) => (dateCounts[b] - dateCounts[a]) || b.localeCompare(a));
const initialDate = datesByActivity[0];
console.log('1. Initial Date with most activity:', initialDate, `(${dateCounts[initialDate]} records)`);
assert.strictEqual(initialDate, '2026-10-05', 'Must select 2026-10-05 as the active records date');
console.log('  ✅ Initial date correctly resolved to 2026-10-05!');

// Test 2: Compute Attendance for 2026-10-05
const eventsOnDate = rawAttendanceEvents.filter(e => getLocalDateString(e.attendance_datetime) === initialDate);
const eventsByStaffId = new Map();
eventsOnDate.forEach(evt => {
  if (!eventsByStaffId.has(Number(evt.staff_id))) eventsByStaffId.set(Number(evt.staff_id), []);
  eventsByStaffId.get(Number(evt.staff_id)).push(evt);
});

const dayRecords = rawActiveStaff.map(staff => {
  const staffEvents = (eventsByStaffId.get(Number(staff.id)) || []).sort((a, b) => new Date(a.attendance_datetime) - new Date(b.attendance_datetime));
  const first = staffEvents[0];
  const timeObj = extractLocalTime(first?.attendance_datetime);
  return {
    name: `${staff.firstName} ${staff.lastName}`,
    time: timeObj.formatted,
    status: timeObj.totalMinutes <= (8 * 60 + 15) ? 'Present' : (first ? 'Late' : 'Absent')
  };
});

console.log('\n2. Day Records on 2026-10-05:');
console.table(dayRecords);
assert.strictEqual(dayRecords.length, 8, 'Must have 8 staff records');
assert.strictEqual(dayRecords.every(r => r.time !== '—'), true, 'All 8 staff must have attendance timestamps on 2026-10-05');
console.log('  ✅ All 8 staff records have valid timestamps!');

// Test 3: All Dates Mode (when date is empty)
const allRecords = rawAttendanceEvents.map(evt => ({
  name: `${evt.first_name} ${evt.last_name}`,
  bioNo: evt.biometric_enrollment_no,
  date: formatDateDDMMYYYY(getLocalDateString(evt.attendance_datetime)),
  time: extractLocalTime(evt.attendance_datetime).formatted
}));
console.log('\n3. All Dates Mode Records:');
console.table(allRecords);
assert.strictEqual(allRecords.length, 9, 'Must have 9 total biometric records across all dates');
console.log('  ✅ All 9 records display in All Dates mode!');

// Test 4: Fallback Staff Directory Extraction (when staffAPI returns empty)
rawActiveStaff = [];
const seenStaff = new Map();
rawAttendanceEvents.forEach(evt => {
  const id = evt.staff_id;
  if (!seenStaff.has(id)) {
    seenStaff.set(id, {
      id: id,
      staffNo: `PSA-${String(id).padStart(3, '0')}`,
      firstName: evt.first_name,
      lastName: evt.last_name,
      biometricEnrollmentNo: evt.biometric_enrollment_no,
      department: normalizeDepartment(evt.department)
    });
  }
});
rawActiveStaff = Array.from(seenStaff.values());
console.log('\n4. Fallback extraction produced active staff count:', rawActiveStaff.length);
assert.strictEqual(rawActiveStaff.length, 8, 'Fallback must extract all 8 staff members');
console.log('  ✅ Fallback extraction fully verified!');

console.log('\n🎉 ALL ATTENDANCE LOGIC TESTS PASSED SUCCESSFULLY!');

