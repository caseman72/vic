const eslint = await import("@eslint/js");
const { defineConfig } = await import("eslint/config");
const tseslint = await import("typescript-eslint");
const jslint = await import("./eslint-js");

const config = defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended
).map(c => {
  if (c.files) {
    c.rules = {
      ...c.rules,
      ...jslint.default[0].rules
    };
  }
  return c;
});

export default config;
