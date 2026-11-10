// dev-server.js
// Lightweight, zero-dependency Node.js development server simulating
// Apache/Nginx clean URL routing for Phronesis Sunesis Admin & future Student portal.
//
// Development-only features added for auth:
//   - /api-proxy/* routes proxy to https://api.phronesis-sunesis.com.ng
//     This is necessary because the live backend uses CORS with wildcard origin (*),
//     which the browser blocks when credentials are needed. By routing through this
//     proxy, the browser's CSRF cookie from the backend is preserved in a
//     same-origin manner. The proxy also handles the _csrf cookie relay.
//
// NOTE: This proxy is for local development only. On the production server
//       (Apache/Nginx), configure a ProxyPass or proxy_pass to achieve the
//       same effect, or serve the frontend from the same domain as the API.

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const API_BACKEND = 'https://api.phronesis-sunesis.com.ng';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 Not Found</h1><p>File not found: ${filePath}</p>`);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

/**
 * Proxy handler for /api-proxy/* requests.
 * Forwards the request to the live backend, relays the response including
 * Set-Cookie headers (adjusting the Secure and SameSite flags for localhost
 * development), and strips the CORS wildcard so the browser accepts the response.
 */
function proxyToBackend(req, res, backendPath, retryCount = 0) {
  const url = new URL(API_BACKEND + backendPath);

  // Forward all incoming request headers, but override Host
  const forwardHeaders = { ...req.headers };
  forwardHeaders['host'] = url.hostname;

  // Remove headers that would confuse the backend or cause issues
  delete forwardHeaders['origin'];
  delete forwardHeaders['referer'];
  delete forwardHeaders['connection'];

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + (url.search || ''),
    method: req.method,
    headers: forwardHeaders,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Adjust Set-Cookie headers for localhost development
    let setCookieHeaders = proxyRes.headers['set-cookie'];
    if (setCookieHeaders) {
      setCookieHeaders = setCookieHeaders.map((cookie) =>
        cookie
          .replace(/;\s*Secure/gi, '')          // Remove Secure (http localhost)
          .replace(/SameSite=Strict/gi, 'SameSite=Lax')  // Allow navigation
      );
    }

    // Build response headers — exclude CORS headers so browser uses same-origin rules
    const responseHeaders = {};
    for (const [key, val] of Object.entries(proxyRes.headers)) {
      const lk = key.toLowerCase();
      if (lk === 'access-control-allow-origin') continue;  // Don't forward wildcard CORS
      if (lk === 'access-control-allow-credentials') continue;
      if (lk === 'access-control-allow-methods') continue;
      if (lk === 'access-control-allow-headers') continue;
      if (lk === 'transfer-encoding') continue; // We'll recalculate
      if (lk === 'set-cookie') {
        responseHeaders['set-cookie'] = setCookieHeaders;
      } else {
        responseHeaders[key] = val;
      }
    }

    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[proxy] Backend request to ${backendPath} failed:`, err.message);
    if (retryCount < 2 && (err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' || err.message.includes('disconnected'))) {
      console.log(`[proxy] Retrying request (${retryCount + 1}/2) in 500ms...`);
      setTimeout(() => {
        proxyToBackend(req, res, backendPath, retryCount + 1);
      }, 500);
      return;
    }
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend unavailable', message: err.message }));
    }
  });

  // Forward the request body for POST/PUT/PATCH, or end immediately for GET/HEAD
  if (req.method === 'GET' || req.method === 'HEAD') {
    proxyReq.end();
  } else {
    req.pipe(proxyReq);
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // ── API Proxy (/api-proxy/*) ──────────────────────────────────────────────
  // Routes /api-proxy/some/path -> https://api.phronesis-sunesis.com.ng/some/path
  // This keeps auth CSRF cookies same-origin with the dev server.
  if (pathname.startsWith('/api-proxy')) {
    let backendPath = pathname.replace(/^\/api-proxy/, '') || '/';
    // Map frontend admin auth routes to the live backend endpoints
    if (backendPath === '/admin/login') {
      backendPath = '/login/admin';
    } else if (backendPath === '/admin/logout' || backendPath === '/logout') {
      backendPath = '/logout/student';
    }
    const queryString = parsedUrl.search || '';
    return proxyToBackend(req, res, backendPath + queryString);
  }

  // 1. Root redirect -> /admin/login (auth guard will redirect to /admin/staffs if authenticated)
  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { Location: '/admin/login' });
    res.end();
    return;
  }

  // 2. Canonical redirect if .html is explicitly requested
  if (pathname.startsWith('/admin/') && pathname.endsWith('.html')) {
    const cleanUrl = pathname.replace(/\.html$/, '');
    res.writeHead(301, { Location: cleanUrl + (parsedUrl.search || '') });
    res.end();
    return;
  }

  // 3. Static assets: /admin/assets/* or /assets/* -> admin/assets/*
  if (pathname.startsWith('/admin/assets/')) {
    const relPath = pathname.replace(/^\/admin\/assets\//, '');
    const fullPath = path.join(__dirname, 'admin', 'assets', relPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return serveFile(res, fullPath);
    }
  }

  if (pathname.startsWith('/assets/')) {
    const relPath = pathname.replace(/^\/assets\//, '');
    const fullPath = path.join(__dirname, 'admin', 'assets', relPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return serveFile(res, fullPath);
    }
  }

  if (pathname.startsWith('/public/')) {
    const relPath = pathname.replace(/^\/public\//, '');
    const fullPath = path.join(__dirname, 'public', relPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return serveFile(res, fullPath);
    }
  }

  // Direct physical file check
  const directPath = path.join(__dirname, pathname);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return serveFile(res, directPath);
  }

  // 4. Admin Routing
  const adminDir = path.join(__dirname, 'admin');

  // Admin dynamic detail routes:
  // /admin/students/:id
  const studentMatch = pathname.match(/^\/admin\/students\/([^/]+)\/?$/);
  if (studentMatch && studentMatch[1] !== 'new') {
    return serveFile(res, path.join(adminDir, 'student-details.html'));
  }

  // /admin/staffs/:id/attendance
  const staffAttendanceMatch = pathname.match(/^\/admin\/staffs\/([^/]+)\/attendance\/?$/);
  if (staffAttendanceMatch) {
    return serveFile(res, path.join(adminDir, 'staff-attendance-history.html'));
  }

  // /admin/staffs/:id
  const staffDetailMatch = pathname.match(/^\/admin\/staffs\/([^/]+)\/?$/);
  if (staffDetailMatch && staffDetailMatch[1] !== 'new') {
    return serveFile(res, path.join(adminDir, 'staff-details.html'));
  }

  // /admin/staff-applications/:id
  const staffAppMatch = pathname.match(/^\/admin\/staff-applications\/([^/]+)\/?$/);
  if (staffAppMatch) {
    return serveFile(res, path.join(adminDir, 'staff-application-detail.html'));
  }

  // Admin clean page routes
  const cleanRoutes = {
    '/admin': 'staffs.html',
    '/admin/': 'staffs.html',
    '/admin/dashboard': 'staffs.html',
    '/admin/students': 'students.html',
    '/admin/registrations': 'students.html',
    '/admin/register-student': 'register-student.html',
    '/admin/staffs': 'staffs.html',
    '/admin/staffs/new': 'register-staff.html',
    '/admin/register-staff': 'register-staff.html',
    '/admin/staff-details': 'staff-details.html',
    '/admin/staff-attendance': 'staff-attendance.html',
    '/admin/staff-attendance-history': 'staff-attendance-history.html',
    '/admin/staff-applications': 'staff-applications.html',
    '/admin/apply-staff': 'apply-staff.html',
    '/admin/apply/staff': 'apply-staff.html',
    '/admin/orders': 'orders.html',
    '/admin/payments': 'orders.html',
    '/admin/settings': 'settings.html',
    '/admin/profile': 'profile.html',
    '/admin/login': 'login.html',
  };

  const normalized = pathname.replace(/\/+$/, '') || '/admin';
  if (cleanRoutes[normalized] || cleanRoutes[pathname]) {
    const targetFile = cleanRoutes[normalized] || cleanRoutes[pathname];
    return serveFile(res, path.join(adminDir, targetFile));
  }

  // Fallback: check if an admin html file matches
  const fallbackAdminFile = path.join(adminDir, `${pathname.replace(/^\/admin\/?/, '')}.html`);
  if (fs.existsSync(fallbackAdminFile) && fs.statSync(fallbackAdminFile).isFile()) {
    return serveFile(res, fallbackAdminFile);
  }

  // 5. Future Student Portal Placeholder
  if (pathname.startsWith('/student')) {
    const studentDir = path.join(__dirname, 'student');
    if (fs.existsSync(studentDir)) {
      const studentClean = pathname.replace(/^\/student\/?/, '') || 'dashboard';
      const studentFile = path.join(studentDir, `${studentClean}.html`);
      if (fs.existsSync(studentFile)) {
        return serveFile(res, studentFile);
      }
    }
  }

  // 6. 404
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head><title>404 Not Found</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>404 - Page Not Found</h2>
        <p>No route matched <code>${pathname}</code>.</p>
        <p><a href="/admin/staffs">Return to Admin Staffs</a></p>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log(`Phronesis Sunesis dev server running at http://localhost:${PORT}`);
  console.log(`Login page:     http://localhost:${PORT}/admin/login`);
  console.log(`Staffs page:    http://localhost:${PORT}/admin/staffs`);
  console.log(`API proxy:      http://localhost:${PORT}/api-proxy/* -> ${API_BACKEND}/*`);
});
