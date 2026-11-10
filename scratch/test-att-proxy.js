import http from 'http';

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let body;
        try { body = JSON.parse(data); } catch { body = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

async function run() {
  // 1. Fetch CSRF via dev-server proxy
  const csrfRes = await request({ hostname: 'localhost', port: 3000, path: '/api-proxy/', method: 'GET' });
  const csrfToken = csrfRes.body?.csrfToken;
  const csrfCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

  // 2. Admin Login via dev-server proxy
  const loginRes = await request({
    hostname: 'localhost', port: 3000, path: '/api-proxy/login/admin', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': csrfCookie }
  }, JSON.stringify({ email: 'admin@phronesis.edu', password: 'admin123' }));
  const tokenCookie = loginRes.headers['set-cookie']?.find(c => c.startsWith('token='))?.split(';')[0] || '';
  const allCookies = `${csrfCookie}; ${tokenCookie}`;

  // 3. Fetch /admin/staff via dev-server proxy (simulates the browser)
  console.log('\n=== Dev-server /api-proxy/admin/staff ===');
  const staffRes = await request({
    hostname: 'localhost', port: 3000, path: '/api-proxy/admin/staff', method: 'GET',
    headers: { 'Cookie': allCookies, 'Accept': 'application/json' }
  });
  console.log('Status:', staffRes.statusCode);
  console.log('Top-level keys:', typeof staffRes.body === 'object' ? Object.keys(staffRes.body) : staffRes.body);
  const staffList = staffRes.body?.staff || [];
  console.log('Staff count:', staffList.length);

  // 4. Fetch /admin/staff-attendance via dev-server proxy
  console.log('\n=== Dev-server /api-proxy/admin/staff-attendance ===');
  const attRes = await request({
    hostname: 'localhost', port: 3000, path: '/api-proxy/admin/staff-attendance', method: 'GET',
    headers: { 'Cookie': allCookies, 'Accept': 'application/json' }
  });
  console.log('Status:', attRes.statusCode);
  console.log('Top-level keys:', typeof attRes.body === 'object' ? Object.keys(attRes.body) : attRes.body);
  const attData = attRes.body?.data || attRes.body?.attendance || [];
  console.log('Attendance records count:', Array.isArray(attData) ? attData.length : typeof attData);

  // 5. Simulate the exact JS parsing:
  // staffAttendanceAPI.list() returns { data: attRes.body, status, ok }
  // staff-attendance.js line 111: rawEvents = attRes?.data?.data || attRes?.data?.results || attRes?.data || []
  const simulatedAttRes = { data: attRes.body, status: attRes.statusCode, ok: attRes.statusCode === 200 };
  const rawEvents = simulatedAttRes?.data?.data || simulatedAttRes?.data?.results || simulatedAttRes?.data || [];
  console.log('\nSimulated rawEvents extraction:');
  console.log('  attRes.data?.data type:', Array.isArray(attRes.body?.data) ? `Array(${attRes.body.data.length})` : typeof attRes.body?.data);
  console.log('  Resulting rawEvents:', Array.isArray(rawEvents) ? `Array(${rawEvents.length})` : rawEvents);

  // 6. Simulate staffAPI.list() parsing:
  // staffAPI.list() returns { data: staffRes.body, status, ok }
  // staff-attendance.js line 95: staffData = staffRes?.data?.staff || staffRes?.data?.data || staffRes?.data || []
  const simulatedStaffRes = { data: staffRes.body, status: staffRes.statusCode, ok: staffRes.statusCode === 200 };
  const staffData = simulatedStaffRes?.data?.staff || simulatedStaffRes?.data?.data || simulatedStaffRes?.data || [];
  console.log('\nSimulated staffData extraction:');
  console.log('  staffRes.data?.staff type:', Array.isArray(staffRes.body?.staff) ? `Array(${staffRes.body.staff.length})` : typeof staffRes.body?.staff);
  console.log('  Resulting staffData:', Array.isArray(staffData) ? `Array(${staffData.length})` : staffData);
  
  // 7. Check dates
  if (Array.isArray(rawEvents) && rawEvents.length > 0) {
    const dates = [...new Set(rawEvents.map(e => e.attendance_datetime?.substring(0, 10)))];
    console.log('\nDistinct date parts in attendance records:', dates);
    console.log('Today is: 2026-11-05');
    console.log('With getLocalDateString (UTC+1 offset), these dates resolve to:');
    rawEvents.forEach(e => {
      const dt = e.attendance_datetime;
      const d = new Date(dt);
      const utcHours = d.getUTCHours();
      const isNextDay = (utcHours + 1) >= 24;
      const adjustedDate = new Date(d);
      if (isNextDay) adjustedDate.setUTCDate(adjustedDate.getUTCDate() + 1);
      const resolved = `${adjustedDate.getUTCFullYear()}-${String(adjustedDate.getUTCMonth()+1).padStart(2,'0')}-${String(adjustedDate.getUTCDate()).padStart(2,'0')}`;
      console.log(`  ${dt} -> ${resolved}`);
    });
  }
}

run().catch(console.error);

