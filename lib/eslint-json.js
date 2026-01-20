// @ref = https://github.com/eslint/json
const json = await import("@eslint/json");

// no tabs or trailing spaces rule
const noTsRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow any tab characters or trailing space",
      recommended: true
    },
    messages: {
      unexpectedTab: "Unexpected tab character (use spaces instead).",
      unexpectedSpace: "Trailing space character found (remove)."
    }
  },
  create(context) {
    return {
      Document() {
        const sourceCode = context.sourceCode;
        const reTrailing = /[ ]+$/;
        sourceCode.lines.forEach((lineText, index) => {
          const isTrailing = reTrailing.test(lineText);

          const lineNumber = index + 1;
          let column = 1;
          for (const char of lineText) {
            if (char === "\t") {
              context.report({
                loc: {
                  start: { line: lineNumber, column },
                  end:   { line: lineNumber, column: column + 1 }
                },
                messageId: "unexpectedTab"
              });
            }
            column++;
          }

          if (isTrailing) {
            context.report({
              loc: {
                start: { line: lineNumber, column },
                end:   { line: lineNumber, column: column + 1 }
              },
              messageId: "unexpectedSpace"
            });
          }
        });
      }
    };
  }
};

export default [
  {
    plugins: {
      json: json.default
    },
    languageOptions: {
      parser: json.JSONLanguage
    }
  },
  // lint JSON files
  {
    files: ["**/*.json"],
    language: "json/json",
    plugins: {
      custom: {
        rules: {
          "no-tabs": noTsRule
        }
      }
    },
    rules: {
      "custom/no-tabs": "error",
      "json/no-duplicate-keys": "error"
    }
  },
  // lint JSONC files
  {
    files: ["**/*.jsonc", ".vscode/*.json"],
    language: "json/jsonc",
    plugins: {
      custom: {
        rules: {
          "no-tabs": noTsRule
        }
      }
    },
    rules: {
      "custom/no-tabs": "error",
      "json/no-duplicate-keys": "error"
    }
  },
  // lint JSON5 files
  {
    files: ["**/*.json5"],
    language: "json/json5",
    plugins: {
      custom: {
        rules: {
          "no-tabs": noTsRule
        }
      }
    },
    rules: {
      "custom/no-tabs": "error",
      "json/no-duplicate-keys": "error"
    }
  }
];
