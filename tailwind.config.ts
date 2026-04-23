import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- SnowFox brand palette ---
        // Primary is a deep near-black (the "navy" token name is legacy; the
        // visual is nearly black with a subtle blue undertone, per the logo).
        navy: {
          900: "#0F1218", // core brand — logo & wordmark color
          700: "#1A2332",
          500: "#2A3547",
        },
        // Crimson accent — the small red mark on the "X" in SNOWFOX.
        // Used sparingly: CTAs, progress bar, band chip.
        fox: {
          600: "#E63946",
          500: "#F05563",
        },
        snow: {
          50: "#FFFFFF",
          100: "#F5F8FC",
          200: "#E6EDF5",
          300: "#CBD5E1",
        },
        ink: {
          900: "#0B0F1A",
          700: "#1A2332",
          500: "#475569",
          400: "#6B7786",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
