/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#FF385C',
          DEFAULT: '#E31C5F',
          dark: '#BD1E5F',
        }
      }
    },
  },
  plugins: [],
}