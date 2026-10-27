// admin/assets/js/navigation.js
// Utility module for clean URL routing, route parameter extraction, and link handling

/**
 * Returns the current route pathname without trailing slashes.
 * e.g. "/admin/students/123" -> "/admin/students/123"
 */
export function getCurrentRoute() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

/**
 * Extracts a dynamic route parameter from the URL.
 * Handles both clean dynamic URLs (e.g., /admin/students/123 -> "123")
 * and fallback query parameters (e.g., ?id=123 -> "123").
 *
 * @param {string} paramName - Name of parameter (e.g. 'id')
 * @param {number} segmentIndexFromEnd - Offset from end of path segments (default 1 = last segment)
 * @returns {string|null}
 */
export function getRouteParam(paramName = 'id', segmentIndexFromEnd = 1) {
  // 1. Check query parameter first if explicitly provided
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has(paramName)) {
    const val = searchParams.get(paramName);
    if (val && val.trim() !== '') return val.trim();
  }

  // 2. Extract from pathname segments
  const segments = window.location.pathname
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) return null;

  const targetSegment = segments[segments.length - segmentIndexFromEnd];
  if (!targetSegment) return null;

  // Don't treat page names or section roots as an ID
  const reservedWords = [
    'admin', 'dashboard', 'students', 'registrations', 'orders',
    'settings', 'profile', 'login', 'apply', 'staff-applications',
    'staffs', 'staff-details.html', 'staff-details', 'staff-attendance', 'staff-attendance.html',
    'register-staff', 'register-staff.html',
    'student-detail.html', 'student-details.html', 'staff-application-detail.html'
  ];

  if (reservedWords.includes(targetSegment.toLowerCase())) {
    return null;
  }

  return decodeURIComponent(targetSegment);
}

/**
 * Programmatic clean route navigation helper.
 * @param {string} cleanPath - e.g. "/admin/dashboard", "/admin/students/123"
 */
export function navigateTo(cleanPath) {
  window.location.href = cleanPath;
}

/**
 * Automatically activates sidebar and bottom navigation links based on current route.
 */
export function highlightActiveNavigation() {
  const currentPath = getCurrentRoute();

  document.querySelectorAll('a.sidebar-item, nav a[data-bottom-nav]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;

    const cleanHref = href.replace(/\/+$/, '');
    const isActive =
      currentPath === cleanHref ||
      (cleanHref !== '/admin' && cleanHref !== '/admin/dashboard' && currentPath.startsWith(cleanHref + '/'));

    if (link.classList.contains('sidebar-item')) {
      if (isActive) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    }
  });
}

// Auto-run on DOMContentLoaded if loaded in page
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    highlightActiveNavigation();
  });
}
