import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#141a2a",
        panel: "#222c44",
        panel2: "#2d3a58",
        line: "#4a5b85",
        cream: "#f3e9d2",
        gold: "#f2b84b",
        mint: "#5fd3a8",
        coral: "#ef6b5b",
        sky: "#7cc4f0",
      },
      fontFamily: {
        pixel: ["var(--font-pixel)", "monospace"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      keyframes: {
        bob: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-2px)" } },
        fly: {
          "0%": { transform: "translate(0,0)" },
          "25%": { transform: "translate(8px,-6px)" },
          "50%": { transform: "translate(-4px,-10px)" },
          "75%": { transform: "translate(-8px,-2px)" },
          "100%": { transform: "translate(0,0)" },
        },
        swing: { "0%,100%": { transform: "rotate(-6deg)" }, "50%": { transform: "rotate(6deg)" } },
      },
      animation: {
        bob: "bob 1.2s ease-in-out infinite",
        fly: "fly 2.4s linear infinite",
        swing: "swing 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
