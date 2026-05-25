/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // PPD design tokens — see CLAUDE.md "Design Palette".
        ppd: {
          navy: '#1B3A5C',
          teal: '#0E7C7B',
          amber: '#F59E0B',
          red: '#DC2626',
          green: '#16A34A',
          white: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
