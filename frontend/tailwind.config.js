/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Space Dark palette
        space: {
          950: "#04040A",
          900: "#0A0A0F",
          800: "#0F0F1A",
          700: "#141424",
          600: "#1A1A2E",
        },
        // Electric Purple accent
        violet: {
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#6C63FF",
          700: "#5A52D5",
        },
        // Cyan highlight
        cyan: {
          400: "#22D3EE",
          500: "#00D9FF",
          600: "#00B4CC",
        },
        // Neutral grays (cool tinted)
        zinc: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          850: "#171B26",
          900: "#111827",
          950: "#070B15",
        },
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "hero-glow": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(108, 99, 255, 0.25), transparent)",
        "card-glow": "radial-gradient(ellipse at top, rgba(108, 99, 255, 0.1), transparent 60%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "spin-slow": "spin 8s linear infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(108, 99, 255, 0.3)" },
          "100%": { boxShadow: "0 0 40px rgba(108, 99, 255, 0.6)" },
        },
      },
      boxShadow: {
        "glow-sm": "0 0 15px rgba(108, 99, 255, 0.3)",
        "glow-md": "0 0 30px rgba(108, 99, 255, 0.4)",
        "glow-lg": "0 0 60px rgba(108, 99, 255, 0.5)",
        "glow-cyan": "0 0 30px rgba(0, 217, 255, 0.4)",
        "card": "0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        "card-hover": "0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
      },
    },
  },
  plugins: [],
};
