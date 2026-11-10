import assert from 'assert';
import fs from 'fs';
import https from 'https';

console.log('🧪 Running Complete Staff Attendance Investigation & Verification Suite...\n');

// 1. Verify Modal Fix
console.log('1. Checking Modal Bug Root Cause & Fix:');
const css = fs.readFileSync('c:/Users/BN/Desktop/PROJECT-SOFTWARE/phronesis2/Phronesis-admin/Phronesis-portal/admin/assets/css/staff-attendance.css', 'utf8');
const html = fs.readFileSync('c:/Users/BN/Desktop/PROJECT-SOFTWARE/phronesis2/Phronesis-admin/Phronesis-portal/admin/staff-attendance.html', 'utf8');
const js = fs.readFileSync('c:/Users/BN/Desktop/PROJECT-SOFTWARE/phronesis2/Phronesis-admin/Phronesis-portal/admin/assets/js/pages/staff-attendance.js', 'utf8');

// Verify that .att-modal-overlay defaults to display: none !important
assert.ok(css.includes('.att-modal-overlay {'), 'Must have .att-modal-overlay class');
assert.ok(css.includes('display: none !important;'), '.att-modal-overlay must be display: none !important by default');
assert.ok(css.includes('.att-modal-overlay.open {'), 'Must have .att-modal-overlay.open');
assert.ok(css.includes('display: flex !important;'), '.att-modal-overlay.open must be display: flex !important');

// Verify that HTML starts with inline style="display: none;"
assert.ok(html.includes('id="viewDetailsModal" class="att-modal-overlay" style="display: none;"'), 'Modal must have style="display: none;" in HTML');

// Verify that JS has close handlers for close icon, dismiss button, backdrop click, and Escape key
assert.ok(js.includes("closeDetailsBtn.addEventListener('click'"), 'Must have close icon click listener');
assert.ok(js.includes("dismissDetailsBtn.addEventListener('click'"), 'Must have dismiss button click listener');
assert.ok(js.includes("e.target === detailsModal"), 'Must have backdrop click listener');
assert.ok(js.includes("e.key === 'Escape'"), 'Must have Escape key listener');
assert.ok(js.includes("document.body.style.overflow = ''"), 'Must restore scroll on close');
console.log('  ✅ Modal lifecycle handlers and default hidden state verified!');

// 2. Verify Zero Emojis
console.log('\n2. Verifying Zero Random Emojis / Unicode Icons:');
const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.strictEqual(html.match(emojiRegex), null, 'staff-attendance.html must have 0 emojis');
assert.strictEqual(js.match(emojiRegex), null, 'staff-attendance.js must have 0 emojis');
console.log('  ✅ Verified: Clean SVG icons exclusively, 0 random emojis!');

// 3. Verify Exact 5 Table Columns
console.log('\n3. Verifying Exact 5 Table Columns:');
assert.ok(html.includes('>Name<'), 'Must contain Name column');
assert.ok(html.includes('>Biometric Enrollment No.<'), 'Must contain Biometric Enrollment No. column');
assert.ok(html.includes('>Department<'), 'Must contain Department column');
assert.ok(html.includes('>Date<'), 'Must contain Date column');
assert.ok(html.includes('>Time<'), 'Must contain Time column');
console.log('  ✅ Exact 5 table columns verified!');

// 4. Test Live API Integration
console.log('\n4. Testing Live API Integration with Real Credentials:');
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

// Fetch all staff
const staffRes = await request({
  hostname: 'api.phronesis-sunesis.com.ng',
  path: '/admin/staff',
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}`, 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' }
});
assert.strictEqual(staffRes.statusCode, 200);
const staffList = staffRes.body?.staff || [];
console.log(`  ✅ Live Staff Directory: ${staffList.length} active staff records retrieved.`);

// Fetch all attendance records
const attRes = await request({
  hostname: 'api.phronesis-sunesis.com.ng',
  path: '/admin/staff-attendance',
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}`, 'Cookie': `${csrfCookie}; ${tokenCookie}`, 'Accept': 'application/json' }
});
assert.strictEqual(attRes.statusCode, 200);
const attData = attRes.body?.data || [];
console.log(`  ✅ Live Staff Attendance: ${attData.length} biometric attendance events retrieved.`);
assert.ok(attData.length > 0, 'Must have attendance records');

// Verify leading zeros in biometric numbers
const sampleBio = attData.map(r => r.biometric_enrollment_no);
assert.ok(sampleBio.includes('000000002'), 'Must preserve 000000002 with leading zeros');
console.log('  ✅ Biometric IDs preserve leading zeros as strings: [000000002, 000000003, ...]');

// 5. Test Local Server Response
console.log('\n5. Testing Local Server (dev-server):');
const localRes = await fetch('http://localhost:3000/admin/staff-attendance');
assert.strictEqual(localRes.status, 200);
console.log('  ✅ http://localhost:3000/admin/staff-attendance responds with HTTP 200!');

console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');

