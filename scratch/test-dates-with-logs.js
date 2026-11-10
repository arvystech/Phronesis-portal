function getLocalDateString(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const utcHours = d.getUTCHours();
    const isNextDay = (utcHours + 1) >= 24;
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

const rawAttendanceEvents = [
  { id: 1, staff_id: 17, attendance_datetime: "2026-10-05T22:48:00.000Z" },
  { id: 2, staff_id: 17, attendance_datetime: "2026-10-06T00:05:00.000Z" },
  { id: 3, staff_id: 18, attendance_datetime: "2026-10-05T17:22:00.000Z" },
  { id: 4, staff_id: 19, attendance_datetime: "2026-10-05T17:23:00.000Z" },
  { id: 5, staff_id: 20, attendance_datetime: "2026-10-05T17:26:00.000Z" },
  { id: 6, staff_id: 21, attendance_datetime: "2026-10-05T17:27:00.000Z" },
  { id: 7, staff_id: 22, attendance_datetime: "2026-10-05T17:29:00.000Z" },
  { id: 8, staff_id: 24, attendance_datetime: "2026-10-05T17:31:00.000Z" },
  { id: 9, staff_id: 25, attendance_datetime: "2026-10-05T17:33:00.000Z" }
];

const datesWithLogs = [...new Set(
  rawAttendanceEvents
    .map(e => getLocalDateString(e.attendance_datetime))
    .filter(Boolean)
)].sort().reverse();

console.log('datesWithLogs:', datesWithLogs);

