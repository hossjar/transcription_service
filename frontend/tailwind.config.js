/* frontend/tailwind.config.js */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // NEW color palette, leaning on parrot-inspired greens, plus accent colors
      colors: {
        primary: "#34D399",   // A bright green (Tailwind's emerald-400)
        secondary: "#10B981", // A deeper green (Tailwind's emerald-600)
        accent: "#F97316",    // A warm accent (Tailwind's orange-500)
        background: "#F9FAFB",
        foreground: "#1F2937",
      },
      // Update fonts to use Inter
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        // keep farsi references if you like
        farsi: ["Vazir", "sans-serif"],
      },
    },
  },
  plugins: [],
};
