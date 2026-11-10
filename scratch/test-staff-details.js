import https from 'https';

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data ? (data.startsWith('{') || data.startsWith('[') ? JSON.parse(data) : data) : null
      }));
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

  // 1. Get staff list from /admin/staff
  const adminStaff = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/admin/staff', method: 'GET', headers });
  console.log('GET /admin/staff status:', adminStaff.statusCode, 'Staff count:', adminStaff.body?.staff?.length);
  const sampleStaff = adminStaff.body?.staff?.[0];
  console.log('Sample staff:', sampleStaff);

  const staffId = sampleStaff?.id || sampleStaff?.staff_id || 1;

  // 2. Test staff detail: /admin/staff/:id vs /staff/:id
  const adminStaffDetail = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: `/admin/staff/${staffId}`, method: 'GET', headers });
  console.log(`GET /admin/staff/${staffId} status:`, adminStaffDetail.statusCode);

  const staffDetail = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: `/staff/${staffId}`, method: 'GET', headers });
  console.log(`GET /staff/${staffId} status:`, staffDetail.statusCode);

  // 3. Test other staff endpoints
  const adminAddStaff = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/admin/add-staff', method: 'OPTIONS', headers });
  console.log('OPTIONS /admin/add-staff status:', adminAddStaff.statusCode);
}

run().catch(console.error);

