/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: {
          DEFAULT: '#1e5fa8',
          osc: '#0f3a6b',
        },
      },
    },
  },
  plugins: [],
}
