import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0B1020",
          soft: "#0F1630",
          card: "#131B3A",
          elevated: "#1A2347",
        },
        border: { DEFAULT: "#26305A", strong: "#34407A" },
        primary: { DEFAULT: "#7C5CFF", hover: "#6B49F5", soft: "#7C5CFF1A" },
        accent: { DEFAULT: "#38BDF8", hover: "#22A9E6", soft: "#38BDF81A" },
        text: { DEFAULT: "#E6EAF7", muted: "#98A2C7", faint: "#6B7499" },
        success: "#34D399",
        warning: "#FBBF24",
        danger: "#F87171",
      },
      borderRadius: { xl: "14px", "2xl": "20px", "3xl": "28px" },
      boxShadow: {
        glow: "0 0 40px -10px rgba(124,92,255,.45)",
        card: "0 8px 30px -12px rgba(0,0,0,.6)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg,#7C5CFF 0%,#38BDF8 100%)",
        "hero-glow":
          "radial-gradient(60% 50% at 50% 0%,rgba(124,92,255,.25) 0%,rgba(11,16,32,0) 70%)",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
