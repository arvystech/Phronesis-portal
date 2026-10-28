// admin/js/helpers.js

export const formatCurrency = (n) =>
  '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 });

export const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export const formatDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const statusColor = (s) => ({
  Pending:  'badge-pending',
  Approved: 'badge-approved',
  Admitted: 'badge-admitted',
  Rejected: 'badge-rejected',
}[s] || 'badge-pending');

export const groupStudentsByDate = (students = []) => {
  const groups = {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  students.forEach((student) => {
    const d = new Date(student.registrationDate);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString();

    let label = '';
    if (d.getTime() === today.getTime()) {
      label = 'TODAY';
    } else if (d.getTime() === yesterday.getTime()) {
      label = 'YESTERDAY';
    } else {
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    }

    if (!groups[dateStr]) {
      groups[dateStr] = { label, date: d, students: [] };
    }
    groups[dateStr].students.push(student);
  });

  // Sort groups descending by date
  return Object.values(groups).sort((a, b) => b.date - a.date);
};

// Also attach to window for non-module script usage if needed
if (typeof window !== 'undefined') {
  window.formatCurrency = formatCurrency;
  window.formatDate = formatDate;
  window.formatDateTime = formatDateTime;
  window.getInitials = getInitials;
  window.statusColor = statusColor;
  window.groupStudentsByDate = groupStudentsByDate;
}
