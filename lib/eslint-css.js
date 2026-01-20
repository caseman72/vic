// @ref = https://github.com/eslint/css
const css = await import("@eslint/css");

export default [{
  files: ["**/*.css"],           // or "**/\*.{css,scss,less}" if you add support later
  language: "css/css",           // ← tells ESLint to use the CSS parser/language
  plugins: {
    css: css.default
  },
  languageOptions: {
    parser: css.CSSLanguage
  },
  rules: {
    "css/font-family-fallbacks": "error",
    "css/no-duplicate-imports": "error",
    "css/no-duplicate-keyframe-selectors": "error",
    "css/no-empty-blocks": "error",
    "css/no-important": "error",
    "css/no-invalid-at-rule-placement": "error",
    "css/no-invalid-at-rules": "error",
    "css/no-invalid-named-grid-areas": "error",
    "css/no-invalid-properties": "error",
    "css/no-unmatchable-selectors": "error",
    "css/prefer-logical-properties": "warn",
    "css/relative-font-units": "warn",
    "css/selector-complexity": "warn",
    "css/use-baseline": "error"
    // "css/use-layers ": "warn"   // not found in this version
  }
}];
