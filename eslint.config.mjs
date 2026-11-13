import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow intentionally unused, underscore-prefixed params (mock/stub signatures).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output and local artifacts (git-ignored; flat config does
    // not read .gitignore).
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "videoassets/**",
    "stitch-designs/**",
    "*.tsbuildinfo",
  ]),
]);

export default eslintConfig;
