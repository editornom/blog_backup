/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  semi: true,
  arrowParens: "avoid",
  plugins: ["prettier-plugin-astro"],
  overrides: [{ files: "*.astro", options: { parser: "astro" } }],
};
