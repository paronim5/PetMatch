/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy/Pastel Palette
        'peach-light': '#FFCDB2',
        'peach-medium': '#FFB4A2',
        'rose-light': '#E5989B',
        'rose-dark': '#B5828C',
        
        // New Semantic Design System
        primary: {
          DEFAULT: '#f43f5e', // rose-500
          hover: '#e11d48',   // rose-600
          light: '#fb7185',   // rose-400
        },
        secondary: {
          DEFAULT: '#fb923c', // orange-400
          hover: '#f97316',   // orange-500
        },
        background: {
          light: '#fff1f2',   // rose-50
          DEFAULT: '#ffffff',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
