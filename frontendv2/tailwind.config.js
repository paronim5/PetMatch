/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'peach-light': '#FFCDB2',
        'peach-medium': '#FFB4A2',
        'rose-light': '#E5989B',
        'rose-dark': '#B5828C',
      },
    },
  },
  plugins: [],
}
