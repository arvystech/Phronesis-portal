import https from 'https';

function checkCors(origin) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.phronesis-sunesis.com.ng',
      path: '/admin/dashboard',
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type,x-csrf-token'
      }
    }, (res) => {
      resolve({
        origin,
        status: res.statusCode,
        allowOrigin: res.headers['access-control-allow-origin'],
        allowCredentials: res.headers['access-control-allow-credentials'],
        allowHeaders: res.headers['access-control-allow-headers'],
        allowMethods: res.headers['access-control-allow-methods'],
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('CORS for https://portal.phronesis-sunesis.com.ng:');
  console.log(await checkCors('https://portal.phronesis-sunesis.com.ng'));

  console.log('CORS for http://localhost:3000:');
  console.log(await checkCors('http://localhost:3000'));
}

run().catch(console.error);

