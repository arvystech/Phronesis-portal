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
  console.log('1. Fetch CSRF:');
  const csrfRes = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/', method: 'GET' });
  const csrfToken = csrfRes.body?.csrfToken;
  const csrfCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
  console.log('CSRF token:', csrfToken);

  console.log('2. Admin Login:');
  const loginRes = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/login/admin',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': csrfCookie }
  }, { email: 'admin@phronesis.edu', password: 'admin123' });

  const token = loginRes.body?.token;
  const tokenCookie = loginRes.headers['set-cookie']?.find(c => c.startsWith('token='))?.split(';')[0] || '';
  console.log('Login status:', loginRes.statusCode, 'Token present:', !!token, 'Token cookie:', tokenCookie);

  console.log('\n3. Test GET /staff with Bearer token only:');
  const staffBearerOnly = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/staff',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  });
  console.log('GET /staff (Bearer only):', staffBearerOnly.statusCode, typeof staffBearerOnly.body === 'object' ? Object.keys(staffBearerOnly.body) : staffBearerOnly.body);

  console.log('\n4. Test GET /staff with Cookie only:');
  const staffCookieOnly = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/staff',
    method: 'GET',
    headers: { 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' }
  });
  console.log('GET /staff (Cookie only):', staffCookieOnly.statusCode, typeof staffCookieOnly.body === 'object' ? Object.keys(staffCookieOnly.body) : staffCookieOnly.body);

  console.log('\n5. Test GET /staff with Bearer + Cookie:');
  const staffBoth = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/staff',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' }
  });
  console.log('GET /staff (Bearer + Cookie):', staffBoth.statusCode, typeof staffBoth.body === 'object' ? Object.keys(staffBoth.body) : staffBoth.body);

  console.log('\n6. Test GET /admin/staff with Bearer only:');
  const adminStaffBearerOnly = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/admin/staff',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  });
  console.log('GET /admin/staff (Bearer only):', adminStaffBearerOnly.statusCode, typeof adminStaffBearerOnly.body === 'object' ? Object.keys(adminStaffBearerOnly.body) : adminStaffBearerOnly.body);

  console.log('\n7. Test GET /admin/staff with Cookie only:');
  const adminStaffCookieOnly = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/admin/staff',
    method: 'GET',
    headers: { 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' }
  });
  console.log('GET /admin/staff (Cookie only):', adminStaffCookieOnly.statusCode, typeof adminStaffCookieOnly.body === 'object' ? Object.keys(adminStaffCookieOnly.body) : adminStaffCookieOnly.body);

  console.log('\n8. Test GET /admin/staff with Bearer + Cookie:');
  const adminStaffBoth = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/admin/staff',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' }
  });
  console.log('GET /admin/staff (Bearer + Cookie):', adminStaffBoth.statusCode, typeof adminStaffBoth.body === 'object' ? Object.keys(adminStaffBoth.body) : adminStaffBoth.body);

  console.log('\n9. Test GET /admin/dashboard with Bearer only vs Cookie only:');
  const dashBearer = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/admin/dashboard',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  });
  console.log('GET /admin/dashboard (Bearer only):', dashBearer.statusCode, dashBearer.body);

  const dashCookie = await request({
    hostname: 'api.phronesis-sunesis.com.ng',
    path: '/admin/dashboard',
    method: 'GET',
    headers: { 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' }
  });
  console.log('GET /admin/dashboard (Cookie only):', dashCookie.statusCode, dashCookie.body);
}

run().catch(console.error);

