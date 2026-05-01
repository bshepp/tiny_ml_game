/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  // Class-based dark mode so the user's explicit choice can override OS preference.
  darkMode: 'class',
  safelist: [
    {
      pattern:
        /(bg|border|text|ring|from|to|via)-(blue|green|red|gray|purple|orange|slate|indigo|yellow|amber)-(50|100|200|300|400|500|600|700|800|900)(\/(10|20|30|40|50|60|70|80|90))?/,
      variants: ['hover', 'focus', 'focus-visible', 'dark', 'motion-safe', 'group-hover'],
    },
  ],
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
