// @ref = https://github.com/eslint/markdown
const markdown = await import("@eslint/markdown");
const { browser /*, node */ } = await import("globals");

export default [
  {
    files: ["**/*.md"],
    plugins: {
      markdown: markdown.default
    },
    language: "markdown/gfm",
    processor: "markdown/markdown",
    rules: {
      "markdown/fenced-code-language":     "error",
      "markdown/heading-increment":      "error",
      "markdown/no-duplicate-definitions":   "error",
      "markdown/no-empty-definitions":     "error",
      "markdown/no-empty-images":        "error",
      "markdown/no-empty-links":         "error",
      "markdown/no-invalid-label-refs":    "error",
      "markdown/no-missing-atx-heading-space": "error",
      "markdown/no-missing-label-refs":    "error",
      "markdown/no-missing-link-fragments":  "error",
      "markdown/no-multiple-h1":         "error",
      "markdown/no-reference-like-urls":     "error",
      "markdown/no-reversed-media-syntax":   "error",
      "markdown/no-space-in-emphasis":     "error",
      "markdown/no-unused-definitions":    "error",
      "markdown/require-alt-text":       "error",
      "markdown/table-column-count":       "error"

      // ───────────────────────────────────────────────
      // Optional / non-recommended rules you might want to enable:
      // "markdown/fenced-code-meta":     "error",   // checks code fence info strings
      // "markdown/no-bare-urls":       "error",
      // "markdown/no-duplicate-headings":  "error",
      // "markdown/no-html":        "error",   // very strict – disallows any HTML
      // ───────────────────────────────────────────────
    }
  },
  // Optional: stricter linting of code *inside* Markdown fences
  {
    files: ["**/*.md/**"],
    languageOptions: {
      globals: {
        ...browser
      }
    },
    rules: {
      // examples – turn on whatever makes sense for your code blocks
      "no-unused-vars": "error",
      "no-undef": "error",
      "no-console": "warn"       // or "error"
      // eqeqeq: "error",
      // etc.
    }
  }
];