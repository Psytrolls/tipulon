/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'Rubik', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        tipul: {
          needed: '#f97316',    // כתום - נדרש טיפול
          progress: '#3b82f6',  // כחול - בטיפול
          valid: '#16a34a',     // ירוק - טיפול בתוקף / הושלם
          urgent: '#ef4444',    // אדום - באיחור / המשך טיפול
        }
      }
    },
  },
  plugins: [],
}
