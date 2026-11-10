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

const rawActiveStaff = [
  { id: 17, staffNo: 'PSA-001', firstName: 'Effa-onun', lastName: 'Ojah', otherNames: '', biometricEnrollmentNo: '000000002', department: 'Teaching' },
  { id: 18, staffNo: 'PSA-002', firstName: 'Josiah', lastName: 'Ntekim', otherNames: '', biometricEnrollmentNo: '000000003', department: 'Teaching' },
  { id: 19, staffNo: 'PSA-003', firstName: 'Rose', lastName: 'Bassey', otherNames: '', biometricEnrollmentNo: '000000004', department: 'Teaching' },
  { id: 20, staffNo: 'PSA-004', firstName: 'Faith', lastName: 'Womi', otherNames: '', biometricEnrollmentNo: '000000005', department: 'Teaching' },
  { id: 21, staffNo: 'PSA-005', firstName: 'Uduak', lastName: 'Aniedi', otherNames: '', biometricEnrollmentNo: '000000006', department: 'Teaching' },
  { id: 22, staffNo: 'PSA-006', firstName: 'Esther', lastName: 'Ekaidi', otherNames: '', biometricEnrollmentNo: '000000007', department: 'Teaching' },
  { id: 24, staffNo: 'PSA-008', firstName: 'Janet', lastName: 'Eremi', otherNames: '', biometricEnrollmentNo: '000000009', department: 'Teaching' },
  { id: 25, staffNo: 'PSA-009', firstName: 'Magdalene', lastName: 'E.', otherNames: '', biometricEnrollmentNo: '000000010', department: 'Teaching' },
];

const rawAttendanceEvents = [
  { id: 1, staff_id: 17, biometric_enrollment_no: "000000002", attendance_datetime: "2026-10-05T22:48:00.000Z" },
  { id: 2, staff_id: 17, biometric_enrollment_no: "000000002", attendance_datetime: "2026-10-06T00:05:00.000Z" },
  { id: 3, staff_id: 18, biometric_enrollment_no: "000000003", attendance_datetime: "2026-10-05T17:22:00.000Z" },
  { id: 4, staff_id: 19, biometric_enrollment_no: "000000004", attendance_datetime: "2026-10-05T17:23:00.000Z" },
  { id: 5, staff_id: 20, biometric_enrollment_no: "000000005", attendance_datetime: "2026-10-05T17:26:00.000Z" },
  { id: 6, staff_id: 21, biometric_enrollment_no: "000000006", attendance_datetime: "2026-10-05T17:27:00.000Z" },
  { id: 7, staff_id: 22, biometric_enrollment_no: "000000007", attendance_datetime: "2026-10-05T17:29:00.000Z" },
  { id: 8, staff_id: 24, biometric_enrollment_no: "000000009", attendance_datetime: "2026-10-05T17:31:00.000Z" },
  { id: 9, staff_id: 25, biometric_enrollment_no: "000000010", attendance_datetime: "2026-10-05T17:33:00.000Z" }
];

function runForDate(selectedDateStr) {
  console.log(`\n============================`);
  console.log(`Running for selectedDateStr = ${selectedDateStr}`);
  console.log(`============================`);

  const eventsOnDate = rawAttendanceEvents.filter(e => {
    return getLocalDateString(e.attendance_datetime) === selectedDateStr;
  });
  console.log(`Events matching date: ${eventsOnDate.length}`);

  const eventsByStaffId = new Map();
  const eventsByBioNo = new Map();

  eventsOnDate.forEach(evt => {
    if (evt.staff_id) {
      if (!eventsByStaffId.has(Number(evt.staff_id))) eventsByStaffId.set(Number(evt.staff_id), []);
      eventsByStaffId.get(Number(evt.staff_id)).push(evt);
    }
    const bio = String(evt.biometric_enrollment_no || '').trim();
    if (bio) {
      if (!eventsByBioNo.has(bio)) eventsByBioNo.set(bio, []);
      eventsByBioNo.get(bio).push(evt);
    }
  });

  const sortChronological = (list) => {
    return [...list].sort((a, b) => new Date(a.attendance_datetime) - new Date(b.attendance_datetime));
  };

  const computedDayRecords = rawActiveStaff.map(staff => {
    let staffEvents = [];
    if (staff.id && eventsByStaffId.has(Number(staff.id))) {
      staffEvents = eventsByStaffId.get(Number(staff.id));
    } else if (staff.biometricEnrollmentNo && eventsByBioNo.has(staff.biometricEnrollmentNo)) {
      staffEvents = eventsByBioNo.get(staff.biometricEnrollmentNo);
    }

    staffEvents = sortChronological(staffEvents);
    const firstCheckIn = staffEvents.length > 0 ? staffEvents[0] : null;

    let status = 'Absent';
    let checkInTimeDisplay = '—';
    let timeSortKey = 999999;

    if (firstCheckIn) {
      const timeObj = extractLocalTime(firstCheckIn.attendance_datetime);
      checkInTimeDisplay = timeObj.formatted;
      timeSortKey = timeObj.totalMinutes;

      const [lateH, lateM] = ATTENDANCE_CONFIG.lateThresholdTime.split(':').map(Number);
      const lateThresholdMinutes = lateH * 60 + lateM;

      if (timeObj.totalMinutes <= lateThresholdMinutes) {
        status = 'Present';
      } else {
        status = 'Late';
      }
    }

    return {
      name: `${staff.firstName} ${staff.lastName}`,
      bioNo: staff.biometricEnrollmentNo,
      time: checkInTimeDisplay,
      status: status
    };
  });

  console.table(computedDayRecords);
}

runForDate('2026-10-06');
runForDate('2026-10-05');
