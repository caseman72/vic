export default [
  {
    files: ["**/*.js"],
    rules: {
      "quotes": ["error", "double"],
      "no-tabs": "error",
      "indent": ["error", 2],
      "comma-dangle": ["error", "never"],
      "brace-style": ["error", "stroustrup", { "allowSingleLine": false }]
    }
  }
];
