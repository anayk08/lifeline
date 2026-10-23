/** @type {import('tailwindcss').Config} */
// Design tokens come from the team's Google Stitch designs. Colors are CSS variables
// so Battery Saver (dark) mode can swap them in src/index.css.
const v = (name) => `var(--${name})`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: v("background"),
        surface: v("surface"),
        "surface-container-lowest": v("surface-container-lowest"),
        "surface-container-low": v("surface-container-low"),
        "surface-container": v("surface-container"),
        "surface-container-high": v("surface-container-high"),
        "surface-variant": v("surface-variant"),
        "on-surface": v("on-surface"),
        "on-surface-variant": v("on-surface-variant"),
        outline: v("outline"),
        primary: v("primary"),
        "primary-container": v("primary-container"),
        "on-primary": v("on-primary"),
        "inverse-primary": v("inverse-primary"),
        secondary: v("secondary"),
        "secondary-container": v("secondary-container"),
        error: v("error"),
        "error-container": v("error-container"),
        "on-error-container": v("on-error-container"),
        open: v("open"),
        "open-container": v("open-container"),
        "on-open-container": v("on-open-container"),
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1.25rem",
        full: "9999px",
      },
      spacing: {
        gutter: "1rem",
        "space-xs": "0.75rem",
        "space-sm": "1rem",
        "space-md": "1.25rem",
        "space-lg": "1.5rem",
        "space-xl": "2.25rem",
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next"', '"Atkinson Hyperlegible"', "system-ui", "sans-serif"],
      },
      // rem units, so the "Larger text" setting (and the phone's own text size) scales everything.
      fontSize: {
        "label-sm": ["0.875rem", { lineHeight: "1.25rem", fontWeight: "700" }],
        "label-md": ["1rem", { lineHeight: "1.375rem", fontWeight: "700" }],
        "label-lg": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "700" }],
        "body-md": ["1rem", { lineHeight: "1.5rem", fontWeight: "400" }],
        "body-lg": ["1.125rem", { lineHeight: "1.75rem", fontWeight: "400" }],
        "headline-md": ["1.375rem", { lineHeight: "1.875rem", fontWeight: "700" }],
        "headline-lg": ["1.5rem", { lineHeight: "2rem", fontWeight: "700" }],
        "headline-xl": ["1.75rem", { lineHeight: "2.25rem", fontWeight: "800" }],
      },
    },
  },
  plugins: [],
};
