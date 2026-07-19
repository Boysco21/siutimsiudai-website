/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Milk Tea Amber (絲襪奶茶色) — primary. Keep in sync with constants/theme.ts.
        brand: {
          DEFAULT: "#A0602F",
          50: "#F5EBE0",
          100: "#E9D3BC",
          500: "#A0602F",
          600: "#824B24",
          700: "#653818",
        },
        // Egg-Tart Gold (蛋撻黃) — highlights.
        accent: {
          DEFAULT: "#EBA524",
          100: "#FBEAC4",
          500: "#EBA524",
          600: "#C9841A",
        },
        // Jade Green (翡翠綠) — health indicators.
        jade: {
          DEFAULT: "#1FA06A",
          100: "#C4EAD6",
          500: "#1FA06A",
        },
        ink: {
          DEFAULT: "#211E18",
          muted: "#6F695C",
          faint: "#9C9484",
        },
        surface: {
          DEFAULT: "#FBF8F1",
          subtle: "#F3EEE3",
          sunken: "#E8E1D2",
        },
        // Premium dark field for locked/overlay scrims (e.g. bg-charcoal/40). Mirrors
        // darkColors.surface in constants/theme.ts so a later dark-mode pass stays consistent.
        charcoal: "#15120D",
      },
      borderRadius: {
        xl: "16px",
        "2xl": "22px",
      },
    },
  },
  plugins: [],
};
