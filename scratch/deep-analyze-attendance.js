// Deep simulation of exactly what staff-attendance.js does with real API data

// Simulated API responses (from actual live API test):
// staffRes = { data: { success: true, staff: [...8 items] }, status: 200, ok: true }
// attRes = { data: { success: true, data: [...9 items] }, status: 200, ok: true }

// === STEP 1: staffData extraction ===
// Line 95: const staffData = staffRes?.data?.staff || staffRes?.data?.data || staffRes?.data || [];
// staffRes.data = { success: true, staff: [...8] }
// staffRes.data.staff = [...8] ← TRUTHY → staffData = [...8] ✓

// === STEP 2: rawEvents extraction ===
// Line 111: const rawEvents = attRes?.data?.data || attRes?.data?.results || attRes?.data || [];
// attRes.data = { success: true, data: [...9] }
// attRes.data.data = [...9] ← TRUTHY → rawEvents = [...9] ✓

// === STEP 3: Determine initial date ===
// All 9 records: 8 on 2026-10-05, 1 on 2026-10-06
// datesWithLogs = ["2026-10-06", "2026-10-05"] (sorted descending)
// todayStr = "2026-11-05"
// datesWithLogs.includes("2026-11-05") → FALSE
// datesWithLogs.length === 0 → FALSE
// So: selectedDateStr = "2026-10-06" ← the date with ONLY 1 record!

// === STEP 4: computeDailyAttendance() with selectedDateStr = "2026-10-06" ===
// eventsOnDate = records where getLocalDateString(dt) === "2026-10-06"
//   Only: { staff_id: 17, attendance_datetime: "2026-10-06T00:05:00.000Z", ... }
//   getLocalDateString("2026-10-06T00:05:00.000Z"):
//     utcHours = 0
//     isNextDay = (0 + 1) >= 24 → FALSE
//     returns "2026-10-06" ✓

// So eventsOnDate = [1 record for staff_id=17]

// rawActiveStaff = 8 staff, IDs: [17, 18, 19, 20, 21, 22, 24, 25]
// computedDayRecords = 8 rows:
//   - staff 17: HAS event → check time
//     dt = "2026-10-06T00:05:00.000Z"
//     extractLocalTime: utcHours=0, watHours=(0+1)%24=1, 1:05 AM
//     totalMinutes = 1*60+5 = 65
//     lateThresholdMinutes = 8*60+15 = 495
//     65 <= 495 → status = "Present" (at 1:05 AM!!!)
//   - staff 18-25: NO event → Absent (since 2026-10-06 is a past working day)
//     2026-10-06 = Tuesday (past, working day) → status = "Absent"

// RESULT: 8 rows would render.
// 1 row: Effa-onun Ojah - Present at 01:05 AM (suspicious but technically within threshold!)
// 7 rows: others - Absent

// So the page SHOULD display 8 rows, NOT "nothing".

// === The REAL PROBLEM ===
// The user says "not displaying". This suggests either:
//
// A) The attendanceContent div stays hidden because of an UNCAUGHT ERROR
//    - e.g. staffAttendanceAPI.list() throws → error panel shown
//    - Or the catch block catches and shows error panel
//
// B) The DATA reaches the page but the STATUS FILTER hides everything
//    - If user had 'Present' or 'Late' selected in filter and all records today show Absent
//
// C) The page is accessing the PRODUCTION URL (portal.phronesis-sunesis.com.ng)
//    and /admin/staff-attendance is returning 401 there because the cookie from
//    portal.phronesis-sunesis.com.ng can't set SameSite=Strict cross-domain to api.phronesis-sunesis.com.ng
//
// MOST LIKELY CAUSE: Production deployment
// When running on portal.phronesis-sunesis.com.ng:
//   - The login cookie IS set (HttpOnly, Secure, SameSite=Strict, domain=api.*)
//   - The browser makes fetch to api.* with credentials: 'include'
//   - SameSite=Strict means cookie is NOT sent on cross-site navigations BUT fetch with credentials IS cross-site
//   - Actually SameSite=Strict DOES block cross-site fetch credential sending!
//   - portal.phronesis-sunesis.com.ng → api.phronesis-sunesis.com.ng IS a cross-site request
//   - So the cookie is NOT sent → 401

// WAIT. The earlier CORS test showed:
//   origin: 'https://portal.phronesis-sunesis.com.ng'
//   allowCredentials: 'true'
//   allowOrigin: 'https://portal.phronesis-sunesis.com.ng'
// This means CORS is configured. But SameSite=Strict still blocks cookie sending!

// Let me verify this SameSite behavior...
// fetch('https://api.phronesis-sunesis.com.ng/admin/staff-attendance', { credentials: 'include' })
// from origin https://portal.phronesis-sunesis.com.ng
// cookie token=...; SameSite=Strict
// Same-site check: portal.phronesis-sunesis.com.ng → api.phronesis-sunesis.com.ng
//   Both share "phronesis-sunesis.com.ng" as the registrable domain (same eTLD+1)
//   Per SameSite spec: same SITE = same eTLD+1
//   portal.phronesis-sunesis.com.ng and api.phronesis-sunesis.com.ng BOTH have eTLD+1 = phronesis-sunesis.com.ng
//   So they ARE same-site! SameSite=Strict DOES apply within same site!
//   → Cookie IS sent ✓

// So the REAL issue must be something else entirely.
// Let me think...

// Wait - the user is saying "attendance records are still not displaying" - 
// does this mean they DO see the page but the TABLE is empty?
// Or they see an error panel?
// Or they see "No Attendance Records Found"?

// Looking at the HTML:
// - attendanceLoading: shown on load, hidden after fetch
// - attendanceError: shown if API fails
// - attendanceEmpty: shown if computedDayRecords.length === 0 OR filteredRecords.length === 0
// - attendanceContent: shown if filteredRecords.length > 0

// If rawActiveStaff.length === 0 → computedDayRecords = [] → filteredRecords = []
//   → attendanceEmpty shown with "No active staff in directory"

// THAT'S IT! What if the staffAPI.list() fails (old 401 for /staff endpoint) and 
// the catch block returns { data: [] } ??
// 
// staffData = { data: [] }?.staff || { data: [] }?.data || { data: [] } || []
//           = undefined || [] || { data: [] } || []  
//           = [] ← rawActiveStaff = []!
//
// BUT WAIT - we already FIXED staffAPI.list() to call /admin/staff now!
// Unless... the browser has cached the OLD staffs.js or api.js?
//
// Or maybe the prod server DOES still serve the old api.js/staff-attendance.js?
// The user may be testing on the PRODUCTION site, not localhost!

console.log("Analysis complete - see comments above");
console.log("Most likely causes in order of probability:");
console.log("1. Browser cached old api.js with /staff (not /admin/staff) → 401 → empty staff list → 0 rows");
console.log("2. Production server not yet deployed with new api.js");
console.log("3. The page shows 8 rows but all 'Absent' and user expects to see only 'Present'");
console.log("4. selectedDateStr defaults to 2026-10-06 (1 present, 7 absent) but user expects 2026-10-05");

