import https from 'https';

function request(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let body;
        try { body = JSON.parse(data); } catch { body = data; }
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const csrfRes = await request({ hostname: 'api.phronesis-sunesis.com.ng', path: '/', method: 'GET' });
  const csrfToken = csrfRes.body?.csrfToken;
  const csrfCookie = csrfRes.headers?.['set-cookie']?.[0]?.split(';')[0] || '';

  const loginRes = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.phronesis-sunesis.com.ng',
      path: '/login/admin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'Cookie': csrfCookie }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: JSON.parse(d || '{}') }));
    });
    req.write(JSON.stringify({ email: 'admin@phronesis.edu', password: 'admin123' }));
    req.end();
  });

  const token = loginRes.body?.token;
  const tokenCookie = loginRes.headers['set-cookie']?.find(c => c.startsWith('token='))?.split(';')[0] || '';
  const headers = { 'Authorization': `Bearer ${token}`, 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' };

  // Test various query parameters on /admin/staff-attendance
  const queries = [
    '',
    '?date=2026-10-05',
    '?date=2026-11-05',
    '?department=Teaching',
    '?page=1&limit=10'
  ];

  for (const q of queries) {
    const res = await new Promise(r => {
      https.get('https://api.phronesis-sunesis.com.ng/admin/staff-attendance' + q, { headers }, resp => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => r({ status: resp.statusCode, body: JSON.parse(d || '{}') }));
      });
    });
    console.log(`GET /admin/staff-attendance${q} -> status: ${res.status}, count: ${res.body?.data?.length}`);
  }
}

run().catch(console.error);

