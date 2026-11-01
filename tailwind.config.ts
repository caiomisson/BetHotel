import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0F172A",
        deep: "#0B1222",
        panel: "#141D31",
        panel2: "#1A2540",
        line: "#2A3756",
        cream: "#E2E8F0",
        muted: "#94A3B8",
        gold: "#F59E0B",
        mint: "#10B981",
        coral: "#EF4444",
        sky: "#3B82F6",
      },
      fontFamily: {
        pixel: ["var(--font-pixel)", "monospace"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
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
        // oscilação lenta e suave (sem flashes rápidos)
        "flicker-dim": {
          "0%,18%,22%,60%,64%,100%": { opacity: "0.22" },
          "20%": { opacity: "0.38" },
          "62%": { opacity: "0.34" },
          "80%": { opacity: "0.26" },
        },
        "flicker-glow": {
          "0%,18%,22%,60%,64%,100%": { opacity: "1" },
          "20%": { opacity: "0.35" },
          "62%": { opacity: "0.5" },
          "80%": { opacity: "0.85" },
        },
      },
      animation: {
        bob: "bob 1.2s ease-in-out infinite",
        fly: "fly 2.4s linear infinite",
        swing: "swing 3s ease-in-out infinite",
        "flicker-dim": "flicker-dim 4.5s ease-in-out infinite",
        "flicker-glow": "flicker-glow 4.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
