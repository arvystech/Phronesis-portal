import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('admin/staff-attendance.html', 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:3000/admin/staff-attendance',
  runScripts: 'dangerously'
});

const document = dom.window.document;

console.log('Testing DOM structure of staff-attendance.html:');
console.log('attendanceLoading:', !!document.getElementById('attendanceLoading'));
console.log('attendanceContent:', !!document.getElementById('attendanceContent'));
console.log('attendanceError:', !!document.getElementById('attendanceError'));
console.log('attendanceEmpty:', !!document.getElementById('attendanceEmpty'));
console.log('attendanceTableBody:', !!document.getElementById('attendanceTableBody'));
console.log('attDatePicker:', !!document.getElementById('attDatePicker'));
console.log('selectedDateDisplay:', !!document.getElementById('selectedDateDisplay'));
console.log('statTotalStaff:', !!document.getElementById('statTotalStaff'));
console.log('statPresentStaff:', !!document.getElementById('statPresentStaff'));
console.log('statLateStaff:', !!document.getElementById('statLateStaff'));
console.log('statAbsentStaff:', !!document.getElementById('statAbsentStaff'));

