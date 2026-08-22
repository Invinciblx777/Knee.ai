/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        page: '#F6F8FB',
        surface: '#FFFFFF',
        line: '#E6EBF2',
        'line-strong': '#D3DCE8',
        navy: '#0B1220',
        body: '#1E293B',
        muted: '#64748B',

        accent: '#3B82F6',
        'accent-light': '#EFF6FF',
        ok: '#10B981',
        'ok-light': '#F0FDF4',
        danger: '#EF4444',
        'danger-light': '#FEF2F2',
        warn: '#F59E0B',
        'warn-light': '#FFFBEB',

        stage: '#0A0F1A',

        ink: {
          100: '#F1F5F9',
          300: '#CBD5E1',
          400: '#94A3B8',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#111A2B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '12px', xl2: '16px' },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        lift: '0 6px 16px -4px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.05)',
        stage: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(1.35)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 260ms cubic-bezier(0.16,1,0.3,1) both',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
