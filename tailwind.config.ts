import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        steam: {
          blue: "#1b9aff",
          dark: "#1b2838",
          darker: "#171a21",
          card: "#16202d",
          border: "#2a475e",
        },
      },
      fontFamily: {
        rajdhani: ["Rajdhani", "sans-serif"],
        noto: ["Noto Sans JP", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
