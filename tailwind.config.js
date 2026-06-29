/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#111827",
          hover: "#1F2937",
          light: "#F3F4F6",
        },
        clipo: {
          bg: "#FAF9F5",
          surface: "#FFFFFF",
          text: {
            primary: "#111827",
            secondary: "#6B7280",
          },
          border: "#F1ECE4",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
        },
        pastel: {
          blue: {
            bg: "#EBF3FF",
            text: "#1D4ED8",
          },
          purple: {
            bg: "#F7F0FF",
            text: "#6B21A8",
          },
          green: {
            bg: "#F0FDF4",
            text: "#15803D",
          },
          orange: {
            bg: "#FFF7ED",
            text: "#C2410C",
          },
          pink: {
            bg: "#FDF2F8",
            text: "#BE185D",
          },
          yellow: {
            bg: "#FEFCE8",
            text: "#854D0E",
          }
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Georgia", "ui-serif", "serif"],
      },
      borderRadius: {
        "clipo-card": "24px",
        "clipo-btn": "12px",
        "clipo-input": "12px",
      },
      boxShadow: {
        "soft-sm": "0 2px 8px rgba(28, 25, 23, 0.015)",
        "soft": "0 10px 35px rgba(28, 25, 23, 0.035)",
        "soft-lg": "0 16px 45px rgba(28, 25, 23, 0.05)",
        "soft-xl": "0 24px 55px rgba(28, 25, 23, 0.08)",
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out forwards",
        "slide-up": "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-down": "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        }
      }
    },
  },
  plugins: [],
}
