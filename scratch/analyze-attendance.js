// Simulate the exact JS parsing logic from staff-attendance.js
// API returns: { success: true, data: [...9 records...] }
// The page code does: attRes?.data?.data || attRes?.data?.results || attRes?.data

// attRes = { data: { success: true, data: [array of 9] }, status: 200, ok: true }
// So attRes?.data = { success: true, data: [...] }
// attRes?.data?.data = [...9 records...] ✓ — this branch is correct!

// BUT WAIT — let's check what staffAPI.list() returns:
// staffAPI.list() calls client.get('/admin/staff', { params })
// client.get returns { data, status, ok } where data is the parsed JSON body
// Backend returns: { success: true, staff: [...] }
// So staffRes = { data: { success: true, staff: [...] }, status: 200, ok: true }

// In staff-attendance.js line 95:
// staffData = staffRes?.data?.staff || staffRes?.data?.data || staffRes?.data || []
// staffRes?.data?.staff = [...8 records] ✓ — first branch wins, correct!

// What about the date matching?
// All records have attendance_datetime like "2026-10-05T22:48:00.000Z" or "2026-10-05T17:22:00.000Z"
// getLocalDateString("2026-10-05T17:22:00.000Z"):
//   d = new Date("2026-10-05T17:22:00.000Z")
//   utcHours = 17
//   isNextDay = (17 + 1) >= 24 → 18 >= 24 → false
//   adjustedDate = same date
//   returns "2026-10-05" ✓

// getLocalDateString("2026-10-05T22:48:00.000Z"):
//   utcHours = 22
//   isNextDay = (22 + 1) >= 24 → 23 >= 24 → false
//   returns "2026-10-05" ✓

// getLocalDateString("2026-10-06T00:05:00.000Z"):
//   utcHours = 0
//   isNextDay = (0 + 1) >= 24 → 1 >= 24 → false
//   returns "2026-10-06" ✓

// So dates resolve correctly.

// The KEY ISSUE: determineInitialDate() sets selectedDateStr to the LATEST date with records.
// All records are from 2026-10-05 and 2026-10-06.
// If datesWithLogs = ["2026-10-06", "2026-10-05"] (sorted descending)
// selectedDateStr = "2026-10-06" (latest date with logs)
// BUT: computeDailyAttendance() matches rawActiveStaff against rawAttendanceEvents WHERE date === selectedDateStr
// Only 1 record is on 2026-10-06, rest are on 2026-10-05.
// So for most staff, they'd show as Absent on 2026-10-06.
// 
// BIGGER ISSUE: After requireAuth() callback sets up data, what does the page actually show?
// 
// Let's trace the REAL extraction bug:
// attRes is from staffAttendanceAPI.list() = client.get('/admin/staff-attendance')
// API returns JSON: { "success": true, "data": [...9 items] }
// client parses this → data variable = { "success": true, "data": [...9 items] }
// staffAttendanceAPI.list() returns { data: { success: true, data: [...] }, status: 200, ok: true }
// 
// In staff-attendance.js line 111:
// rawEvents = attRes?.data?.data || attRes?.data?.results || attRes?.data || []
// attRes?.data = { success: true, data: [...9 items] }
// attRes?.data?.data = [...9 items] ← CORRECT! This should work.
// 
// So where is the bug?
// Let me think about this more carefully...
// 
// OH WAIT. Looking at staffAPI.list() - it was just changed to call /admin/staff first.
// It returns { data: { success: true, staff: [...8 items] }, status: 200, ok: true }
// staffData = staffRes?.data?.staff || ... = [...8 items] ✓
// rawActiveStaff = 8 active staff ✓
// 
// determineInitialDate():
//   - datesWithLogs = from rawAttendanceEvents.map(e => getLocalDateString(e.attendance_datetime))
//   - = ["2026-10-05", "2026-10-06", "2026-10-05", ...] → unique sorted desc = ["2026-10-06", "2026-10-05"]
//   - todayStr = "2026-11-05" (today's date)
//   - datesWithLogs.includes("2026-11-05") → FALSE
//   - datesWithLogs.length === 0 → FALSE
//   - So: selectedDateStr = datesWithLogs[0] = "2026-10-06" ← WRONG! This should be "2026-10-06" which only has 1 record
//
// BUT the real records are from "2026-10-05".
// computeDailyAttendance() will filter eventsOnDate where date === "2026-10-06"
// Only record 2 (staff_id=17, Effa-onun Ojah) matches "2026-10-06".
// So only 1 out of 8 staff will appear as Present/Late, the other 7 will be Absent.
//
// That's not quite "not displaying" - they should still show 8 rows with 7 Absent.
// Unless the display logic hides Absent rows somehow? Let's check...

// Actually the table SHOULD show all 8 staff (some Absent). 
// The page would still show 8 rows. The user says records "not displaying" - 
// could be an error thrown, or maybe the content area stays hidden?

// Let me look for real errors...
// The .catch on staffAttendanceAPI.list() rethrows - if there's an auth error, 
// the whole thing fails and shows error panel instead of content.

console.log("Analysis complete - see comments above");
console.log("The likely display issue:");
console.log("1. If /admin/staff-attendance still returns 401 (auth failure) → shows error panel, no records");
console.log("2. If auth works but date mismatch → shows 8 rows but most are Absent");
console.log("3. If rawActiveStaff is empty → shows 'No active staff' empty state");

