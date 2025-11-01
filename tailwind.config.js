// tailwind.config.js (Corregido)

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- CORRECCIÓN: La sintaxis del glob pattern era incorrecta.
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}