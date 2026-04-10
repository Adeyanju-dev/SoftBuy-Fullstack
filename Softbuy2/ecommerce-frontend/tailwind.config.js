/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        fadeSlideIn: {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        fadeSlideIn: "fadeSlideIn 0.35s ease-out ",
      },
      colors: {
        primary: "#0F172A", // deep navy
        accent: "#38BDF8",  // soft sky blue
        background: "linear-gradient(135deg, #E0F2FE, #F0FDFA)", // new soft gradient
      },
    },
  },
  plugins: [],
};
