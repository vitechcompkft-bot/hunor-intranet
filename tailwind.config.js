/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // COOP leveles zöld paletta
        brand: {
          50: '#f2f9ec',
          100: '#e0f1d2',
          200: '#c3e3a8',
          300: '#9fd176',
          400: '#7cbd4c',
          500: '#5fa531',
          600: '#4f9128',
          700: '#3f7222',
          800: '#345a20',
          900: '#2c4b1d',
        },
        // Hunor Coop márkaszínek
        hunor: {
          red: '#e2001a',
          green: '#5aa23f',
        },
      },
      fontFamily: {
        script: ['Pacifico', 'Brush Script MT', 'cursive'],
      },
    },
  },
  plugins: [],
};
