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
  // 1. Fetch CSRF
  const csrfRes = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/', method: 'GET' });
  const csrfToken = csrfRes.body?.csrfToken;
  const csrfCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

  // 2. Admin Login
  const loginRes = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/login/admin',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': csrfCookie }
  }, { email: 'admin@phronesis.edu', password: 'admin123' });

  const token = loginRes.body?.token;
  const tokenCookie = loginRes.headers['set-cookie']?.find(c => c.startsWith('token='))?.split(';')[0] || '';
  const headers = { 'Authorization': `Bearer ${token}`, 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' };

  // 3. Fetch the attendance endpoint
  console.log('\n=== GET /admin/staff-attendance ===');
  const attRes = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/admin/staff-attendance', method: 'GET', headers });
  console.log('Status:', attRes.statusCode);
  if (attRes.statusCode === 200) {
    console.log('Top-level keys:', typeof attRes.body === 'object' ? Object.keys(attRes.body) : 'NOT OBJECT');
    if (attRes.body?.data) {
      const d = attRes.body.data;
      if (Array.isArray(d)) {
        console.log('data is array, length:', d.length);
        if (d.length > 0) {
          console.log('Sample record (first):', JSON.stringify(d[0], null, 2));
        }
      } else {
        console.log('data type:', typeof d, 'keys:', Object.keys(d || {}));
      }
    } else if (attRes.body?.attendance) {
      const a = attRes.body.attendance;
      console.log('attendance key, length:', Array.isArray(a) ? a.length : typeof a);
      if (Array.isArray(a) && a.length > 0) console.log('Sample:', JSON.stringify(a[0], null, 2));
    } else {
      console.log('Full body:', JSON.stringify(attRes.body, null, 2).slice(0, 1000));
    }
  } else {
    console.log('Body:', attRes.body);
  }

  // 4. Try with query params
  console.log('\n=== GET /admin/staff-attendance with date param ===');
  const attDate = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/admin/staff-attendance?date=2026-10-05', method: 'GET', headers });
  console.log('Status:', attDate.statusCode, 'Keys:', typeof attDate.body === 'object' ? Object.keys(attDate.body) : attDate.body);

  // 5. Try the /admin/staff/:id/attendance endpoint for a known staff
  console.log('\n=== GET /admin/staff/17/attendance ===');
  const staffAtt = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/admin/staff/17/attendance', method: 'GET', headers });
  console.log('Status:', staffAtt.statusCode, 'Body:', JSON.stringify(staffAtt.body, null, 2).slice(0, 500));

  // 6. Check /attendance endpoint
  console.log('\n=== GET /attendance ===');
  const attGeneric = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/attendance', method: 'GET', headers });
  console.log('Status:', attGeneric.statusCode, 'Keys:', typeof attGeneric.body === 'object' ? Object.keys(attGeneric.body) : attGeneric.body);
}

run().catch(console.error);

