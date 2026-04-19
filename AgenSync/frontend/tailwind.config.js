/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#6B7280",
        soft: "#F1F5F9",
        line: "#E2E8F0",
        brand: "#2563EB",
        "brand-dark": "#1D4ED8",
        accent: "#2563EB",
        success: "#16A34A",
        danger: "#DC2626",
        warning: "#D97706"
      },
      boxShadow: {
        panel: "0 18px 50px rgba(15, 23, 42, 0.10)",
        soft: "0 10px 28px rgba(15, 23, 42, 0.07)"
      }
    }
  },
  plugins: []
};
