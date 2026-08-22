/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        page: '#FDFCF6', // Anthropic creamy background
        surface: '#FFFFFF',
        line: '#E5E2DC',
        'line-strong': '#D4D0C5',
        navy: '#171717', // Deep charcoal
        body: '#3E3E3E', // Warm dark gray
        muted: '#6E6A64', // Earthy gray

        accent: '#D05C35', // Elegant terracotta/rust
        'accent-light': '#F9EDE9',
        ok: '#147D5F', // Deep, clinical green (MyHealthPrac inspired)
        'ok-light': '#E9F5F0',
        danger: '#B33A3A',
        'danger-light': '#FCEBEB',
        warn: '#B97116',
        'warn-light': '#FDF2E2',

        stage: '#F7F5F0',

        ink: {
          100: '#F0EFEB',
          300: '#D5D3CC',
          400: '#B0AEA6',
          600: '#6E6A64',
          700: '#4D4A45',
          800: '#3E3E3E',
          900: '#171717',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: { card: '8px', xl2: '12px' },
      boxShadow: {
        card: '0 2px 8px -2px rgba(23, 23, 23, 0.04), 0 1px 2px rgba(23, 23, 23, 0.02)',
        lift: '0 8px 24px -4px rgba(23, 23, 23, 0.06), 0 4px 8px rgba(23, 23, 23, 0.04)',
        stage: 'inset 0 0 0 1px rgba(0,0,0,0.03)',
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
        'fade-up': 'fade-up 360ms cubic-bezier(0.2,1,0.3,1) both',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
