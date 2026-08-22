/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        page: '#FFF5E4',        // Warm beach cream
        surface: '#FFFCF7',     // Warm white cards
        line: '#2D2016',        // Bold dark brown borders (toon style)
        'line-light': '#E8DCC8', // Subtle inner borders
        'line-strong': '#1A130D',
        navy: '#1A130D',        // Deep espresso for text
        body: '#3B2F24',        // Warm dark brown
        muted: '#8B7D6B',       // Warm taupe

        accent: '#E8772E',      // Vibrant orange
        'accent-light': '#FFF0E4',
        ok: '#2D9F6F',          // Lush green
        'ok-light': '#E6F7EF',
        danger: '#E85D75',      // Warm pink-red
        'danger-light': '#FFF0F3',
        warn: '#D4A017',        // Golden amber
        'warn-light': '#FFF8E1',

        stage: '#F5EDDE',       // Warm beige for images

        ink: {
          100: '#F0E8D8',
          300: '#D5C9B5',
          400: '#B0A28E',
          600: '#8B7D6B',
          700: '#5C4F3E',
          800: '#3B2F24',
          900: '#1A130D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'ui-serif', 'Georgia', 'serif'],
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '14px', xl2: '12px' },
      boxShadow: {
        card: '4px 4px 0 #2D2016',
        'card-sm': '3px 3px 0 #2D2016',
        lift: '6px 6px 0 #2D2016',
        stage: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
        btn: '3px 3px 0 #2D2016',
        'btn-hover': '1px 1px 0 #2D2016',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(1.35)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 400ms cubic-bezier(0.2,1,0.3,1) both',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
