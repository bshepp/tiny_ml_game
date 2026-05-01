/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  // Class-based dark mode so the user's explicit choice can override OS preference.
  darkMode: 'class',
  // No safelist needed: all dynamic classes (STAT_CARD_STYLES, STAT_VALUE_STYLES,
  // probability bars) are written as full literal strings that Tailwind's JIT
  // can detect via content scanning.
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
    },
  },
  plugins: [],
};
