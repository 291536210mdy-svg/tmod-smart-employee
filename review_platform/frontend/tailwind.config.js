/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d2433",
        panel: "#f7f5ef",
        line: "#ded8c8",
        teal: "#0f766e",
        coral: "#c2410c"
      },
      boxShadow: {
        soft: "0 10px 32px rgba(29, 36, 51, 0.08)"
      }
    }
  },
  plugins: []
};
