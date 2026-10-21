import type { Config } from "tailwindcss";

// Cash Guard colours point at the CSS variables in src/styles/tokens.css.
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

// Added on top of Tailwind's defaults (the AI test and error pages still use the default palette).
// Cash Guard screens use only these tokens. Brief type scale 12/14/16/20/28/36 = xs, sm, base, xl, title, 4xl.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
        accent: { DEFAULT: token("accent"), hover: token("accent-hover") },
        safe: token("safe"),
        "at-risk": token("at-risk"),
        shortfall: token("shortfall"),
        ai: token("ai"),
      },
      fontSize: {
        title: ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.01em" }],
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: { card: "10px", input: "8px" },
      boxShadow: {
        soft: "0 1px 2px rgb(26 26 24 / 0.05), 0 1px 3px rgb(26 26 24 / 0.04)",
      },
      maxWidth: { content: "75rem" },
    },
  },
  plugins: [],
};
export default config;
