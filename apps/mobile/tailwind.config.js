/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Ink — warm blacks
        ink: {
          900: "#14100B",
          800: "#1F1A14",
          700: "#2A2419",
          600: "#3F372D",
          500: "#544A3C",
          400: "#6D655A",
          300: "#8A8275",
        },
        // Cream — warm whites
        cream: {
          50: "#FBF7EF",
          100: "#F5EFE2",
          200: "#EAE0C9",
          300: "#D9CDB2",
        },
        // Terracota — brand primary
        terracota: {
          300: "#D88968",
          400: "#C56740",
          500: "#B5452B",
          600: "#93341F",
          700: "#7C2916",
        },
        // Clay — value/yield accent
        clay: {
          300: "#E0B97D",
          400: "#D4A668",
          500: "#C89450",
          600: "#A27539",
          700: "#7D5826",
        },
        // Stone — warm neutrals
        stone: {
          200: "#D5CDBD",
          300: "#BDB5A5",
          400: "#9E9688",
          500: "#7F786C",
          600: "#615B51",
        },
        // Semantic
        success: {
          DEFAULT: "#6B7A38",
          fg: "#A8B65A",
          bg: "#2A3318",
        },
        warning: {
          DEFAULT: "#C28920",
          fg: "#E0A952",
          bg: "#3D2D0F",
        },
        danger: {
          DEFAULT: "#A8311A",
          fg: "#D4572F",
          bg: "#3D1410",
        },
      },
      fontFamily: {
        display: ["Fraunces_500Medium"],
        "display-regular": ["Fraunces_400Regular"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        mono: ["JetBrainsMono_400Regular"],
        "mono-medium": ["JetBrainsMono_500Medium"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["11px", { lineHeight: "14px", letterSpacing: "0.8px" }],
        sm: ["13px", { lineHeight: "19.5px" }],
        base: ["15px", { lineHeight: "23px" }],
        md: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "24px" }],
        xl: ["24px", { lineHeight: "30px" }],
        "2xl": ["32px", { lineHeight: "35px" }],
        "3xl": ["40px", { lineHeight: "42px" }],
        hero: ["48px", { lineHeight: "48px" }],
        "hero-xl": ["56px", { lineHeight: "56px" }],
      },
      borderRadius: {
        xs: "6px",
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
        "2xl": "36px",
      },
      spacing: {
        "safe-top": "44px",
        "safe-bottom": "34px",
      },
    },
  },
  plugins: [],
};
