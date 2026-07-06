/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        industrial: {
          50: "#f7f9fb",
          100: "#e7edf3",
          200: "#cfdbe7",
          500: "#49667f",
          700: "#2f465c",
          900: "#172534"
        },
        signal: {
          mint: "#d9f5e8",
          sky: "#d9ecfb",
          amber: "#fff2c7",
          violet: "#eadffd",
          slate: "#e4ebf2",
          orange: "#ffe3ca"
        }
      },
      boxShadow: {
        panel: "0 16px 40px rgba(23, 37, 52, 0.08)"
      }
    }
  },
  plugins: []
};
