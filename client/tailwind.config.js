/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
          400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
          800: '#9a3412', 900: '#7c2d12',
        },
        ink: { 500: '#6b7280', 700: '#374151', 900: '#111827' },
      },
      fontFamily: {
        sans: ['Hind Siliguri', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        bn: ['Hind Siliguri', 'Noto Sans Bengali', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)',
        pop: '0 12px 32px -8px rgba(16,24,40,.24)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-in': 'fade-in .18s ease-out', 'slide-up': 'slide-up .22s ease-out' },
    },
  },
  plugins: [],
};
