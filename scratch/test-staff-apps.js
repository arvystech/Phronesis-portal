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

  const app1 = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/admin/staff/applications', method: 'GET', headers });
  console.log('/admin/staff/applications:', app1.statusCode, app1.body);

  const app2 = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/staff/applications', method: 'GET', headers });
  console.log('/staff/applications:', app2.statusCode, app2.body);

  const app3 = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/admin/staff-applications', method: 'GET', headers });
  console.log('/admin/staff-applications:', app3.statusCode, app3.body);
}

run().catch(console.error);

