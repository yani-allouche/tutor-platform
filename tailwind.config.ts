import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        mist: "#f5f7f8",
        leaf: "#2f6f5e",
        coral: "#d95f49"
      }
    }
  },
  plugins: []
};

export default config;
