/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./assets/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        bg: '#07111f',
        'bg-elevated': 'rgba(8, 16, 30, 0.72)',
        'bg-soft': 'rgba(255, 255, 255, 0.04)',
        surface: 'rgba(13, 24, 42, 0.76)',
        'surface-strong': 'rgba(9, 18, 31, 0.92)',
        border: 'rgba(255, 255, 255, 0.12)',
        text: '#eff4ff',
        muted: '#a9b7d0',
        line: 'rgba(255, 255, 255, 0.08)',
        accent: '#ff7a59',
        'accent-2': '#ffb36b',
        'accent-3': '#7ce7d5',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        space: ['"Space Grotesk"', 'sans-serif'],
      },
      screens: {
        'md': '820px',
        'lg': '1080px',
      }
    },
  },
  plugins: [],
}
