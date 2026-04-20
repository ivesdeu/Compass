/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scope utilities so global index.html is unaffected; skip preflight to avoid resetting the app shell
  important: '#advisor-react-composer-root',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
