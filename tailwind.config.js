// tailwind.config.js (Corregido)

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.${js,ts,jsx,tsx}", // <--- Corregido a un solo slash
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}