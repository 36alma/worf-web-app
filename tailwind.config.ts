import type { Config } from "tailwindcss";

const config: Config = {
  // The app forces dark via <html data-theme="dark">, so `dark:` variants must
  // key off that attribute (not a `.dark` class, which is never set).
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface ramp — maps to the CSS custom properties in app/globals.css
        surface: {
          DEFAULT: "var(--bg-surface)",
          0: "var(--bg-root)",
          1: "var(--bg-surface)",
          2: "var(--bg-elevated)",
          sidebar: "var(--bg-sidebar)",
          hover: "var(--bg-hover)",
          active: "var(--bg-active)",
          input: "var(--bg-input)",
        },
        border: {
          DEFAULT: "var(--border-default)",
          strong: "var(--border-hover)",
          subtle: "var(--border-subtle)",
          focus: "var(--border-focus)",
        },
        // accent uses an rgb channel so opacity modifiers (ring-accent/50) work
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          hover: "var(--accent-hover)",
          muted: "var(--accent-muted)",
          subtle: "var(--accent-subtle)",
        },
        fg: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-tertiary)",
          disabled: "var(--text-disabled)",
        },
        success: { DEFAULT: "rgb(var(--success-rgb) / <alpha-value>)", bg: "var(--success-bg)" },
        warning: { DEFAULT: "rgb(var(--warning-rgb) / <alpha-value>)", bg: "var(--warning-bg)" },
        danger: { DEFAULT: "rgb(var(--error-rgb) / <alpha-value>)", bg: "var(--error-bg)" },
        info: { DEFAULT: "rgb(var(--info-rgb) / <alpha-value>)", bg: "var(--info-bg)" },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      fontSize: {
        // Spec typography scale (only weights 400 / 500)
        title: ["20px", { lineHeight: "28px", fontWeight: "500" }],
        section: ["14px", { lineHeight: "20px", fontWeight: "500" }],
        body: ["13px", { lineHeight: "20px" }],
        caption: ["11px", { lineHeight: "16px" }],
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
