/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0F172A',
        accent: '#3B82F6',
        ok: '#10B981',
        danger: '#EF4444',
        warn: '#F59E0B',
        line: '#E2E8F0',
        muted: '#64748B',
        surface: '#F8FAFC',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '8px' },
    },
  },
  plugins: [],
}
