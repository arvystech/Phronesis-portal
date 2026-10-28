/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './admin/**/*.html',
    './admin/assets/js/**/*.js',
    './student/**/*.html',
    './student/assets/js/**/*.js',
    './index.html',
    './*.html',
  ],
  theme: {
    extend: {
      colors: {
        royal:      '#17338F',
        'royal-deep': '#10276B',
        'royal-light': '#EEF1F9',
        gold:       '#D4B15A',
        'gold-muted': '#C4A040',
        cream:      '#F7F1DF',
        'warm-white': '#F8F7F3',
        border:     '#E7E1D1',
        'input-bg': '#FFFDF8',
        'text-dark': '#1E2430',
        'text-soft': '#667085',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      boxShadow: {
        card:  '0 4px 20px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 30px rgba(0,0,0,0.07)',
        blue:  '0 4px 14px rgba(23,51,143,0.15)',
      },
      borderRadius: {
        xl2: '18px',
        xl3: '24px',
      },
    },
  },
  plugins: [],
};
