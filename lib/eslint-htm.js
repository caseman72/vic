// Dynamic import ESLint and html-eslint plugin/parser
const htmlPlugin = await import("@html-eslint/eslint-plugin");
const htmlParser = await import("@html-eslint/parser");

export default [{
  files: ["**/*.html", "**/*.htm"],
  plugins: {
    "@html-eslint": htmlPlugin.default
  },
  languageOptions: {
    parser: htmlParser.default
  },
  rules: {
    // Best Practice
    "@html-eslint/no-duplicate-attrs": "error",
    "@html-eslint/no-duplicate-id": "error",
    "@html-eslint/no-obsolete-attrs": "error",
    "@html-eslint/no-obsolete-tags": "error",
    "@html-eslint/require-closing-tags": "error",
    "@html-eslint/require-doctype": "error",
    "@html-eslint/require-li-container": "error",
    "@html-eslint/use-baseline": "error",

    // SEO
    "@html-eslint/no-multiple-h1": "error",
    "@html-eslint/require-lang": "error",
    "@html-eslint/require-title": "error",

    // Accessibility
    "@html-eslint/require-img-alt": "error",

    // Style (warn - formatting preferences)
    "@html-eslint/attrs-newline": "warn",
    "@html-eslint/element-newline": "warn",
    "@html-eslint/indent": "warn",
    "@html-eslint/no-trailing-spaces": "warn",
    "@html-eslint/no-extra-spacing-attrs": "warn",
    "@html-eslint/quotes": "warn"
  }
}];
