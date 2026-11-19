import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#1f3a5f",
        wine: "#7a1020",
        gold: "#c9a227",
      },
    },
  },
  plugins: [],
};

export default config;
