export default {
  files: ["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx", "**/*.mjs", "**/*.mts" ],
  rules: {
    "quotes": ["error", "double"],
    "no-tabs": "error",
    "indent": ["error", 2],
    "comma-dangle": ["error", "never"],
    "brace-style": ["error", "stroustrup", { "allowSingleLine": false }],
    "no-unused-vars": ["error", {
      "vars": "all",
      "args": "after-used",
      "ignoreRestSiblings": true,
      "caughtErrors": "none"          // ← most people turn this off
    }]
  }
};
