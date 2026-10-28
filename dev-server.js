// dev-server.js
// Lightweight, zero-dependency Node.js development server simulating
// Apache/Nginx clean URL routing for Phronesis Sunesis Admin & future Student portal.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

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

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Root redirect -> /admin/dashboard
  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { Location: '/admin/dashboard' });
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
    return serveFile(res, path.join(adminDir, 'staff-attendance.html'));
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
        <p><a href="/admin/dashboard">Return to Admin Dashboard</a></p>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log(`Phronesis Sunesis dev server running at http://localhost:${PORT}`);
  console.log(`Admin Dashboard: http://localhost:${PORT}/admin/dashboard`);
});
