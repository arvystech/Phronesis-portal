import http from 'http';

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
  console.log('1. Dev-server GET /api-proxy/ :');
  const csrfRes = await request({ hostname: 'localhost', port: 3000, path: '/api-proxy/', method: 'GET' });
  console.log('CSRF status:', csrfRes.statusCode, 'CSRF body:', csrfRes.body);
  const csrfToken = csrfRes.body?.csrfToken;
  const csrfCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

  console.log('2. Dev-server POST /api-proxy/login/admin :');
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api-proxy/login/admin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Cookie': csrfCookie
    }
  }, JSON.stringify({ email: 'admin@phronesis.edu', password: 'admin123' }));
  console.log('Login status:', loginRes.statusCode, 'Login token present:', !!loginRes.body?.token);
  const tokenCookie = loginRes.headers['set-cookie']?.find(c => c.startsWith('token='))?.split(';')[0] || '';

  console.log('3. Dev-server GET /api-proxy/admin/staff :');
  const staffRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api-proxy/admin/staff',
    method: 'GET',
    headers: {
      'Cookie': `${csrfCookie}; ${tokenCookie}`,
      'Accept': 'application/json'
    }
  });
  console.log('Staff list status:', staffRes.statusCode, 'Staff count:', staffRes.body?.staff?.length);
}

run().catch(console.error);

