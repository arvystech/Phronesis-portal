import https from 'https';

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
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
  const csrfRes = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/', method: 'GET' });
  const csrfToken = csrfRes.body?.csrfToken;
  const csrfCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

  const loginRes = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/login/admin',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': csrfCookie }
  }, { email: 'admin@phronesis.edu', password: 'admin123' });

  const token = loginRes.body?.token;
  const tokenCookie = loginRes.headers['set-cookie']?.find(c => c.startsWith('token='))?.split(';')[0] || '';
  const headers = { 'Authorization': `Bearer ${token}`, 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' };

  const attRes = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/admin/staff-attendance', method: 'GET', headers });
  const records = attRes.body?.data || [];

  console.log('Total records:', records.length);
  records.forEach((r, i) => {
    const dt = r.attendance_datetime;
    const utcDate = new Date(dt);
    // Raw UTC date string from API
    const rawDate = dt.split('T')[0];  // YYYY-MM-DD in UTC
    // WAT = UTC+1
    const watDate = new Date(utcDate.getTime() + 60 * 60 * 1000);
    const watDateStr = watDate.toISOString().split('T')[0];
    console.log(`Record ${i+1}: staff_id=${r.staff_id}, name=${r.first_name} ${r.last_name}, datetime=${dt}, raw_date_part=${rawDate}, WAT_date=${watDateStr}`);
  });
  
  // Simulate what the JS does: getLocalDateString uses local timezone
  // The issue: "2026-10-05T22:48:00.000Z" in UTC = "2026-10-06T23:48:00+01:00" in WAT  
  // Wait - UTC+1: 22:48 UTC -> 23:48 WAT on the SAME day 2026-10-05
  // 2026-10-05T22:48:00.000Z -> WAT: 2026-10-05T23:48:00+01:00 (still Oct 5)
  
  console.log('\n--- Time conversion analysis ---');
  records.forEach(r => {
    const dt = r.attendance_datetime;
    const utcDate = new Date(dt);
    const watDate = new Date(utcDate.getTime() + 60 * 60 * 1000);
    console.log(`${dt} -> WAT date: ${watDate.toISOString().split('T')[0]} time: ${watDate.toISOString().split('T')[1].slice(0,8)}`);
  });

  // What does new Date().toLocaleDateString do in Node.js on this machine?
  const testDate = new Date('2026-10-05T22:48:00.000Z');
  console.log('\n--- Node.js local time interpretation ---');
  console.log('toISOString():', testDate.toISOString());
  console.log('getFullYear/Month/Date:', testDate.getFullYear(), testDate.getMonth()+1, testDate.getDate());
  console.log('Local string:', testDate.toLocaleDateString());
}

run().catch(console.error);

