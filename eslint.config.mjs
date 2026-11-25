import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";


// ─── RTL by construction (docs/FRESHA_PARITY_ROADMAP.md §2.9) ───
// Warns on physical-direction Tailwind classes in className strings, cn()/clsx()
// calls and cva() variants. Use logical ones instead: ms-/me-/ps-/pe-/start-/end-,
// text-start/text-end, rounded-s/e, border-s/e. Severity is "warn" so existing
// code never fails lint; new code should come in clean.
const PHYSICAL_CLASS =
  /(?:^|[\s:"'`!])-?(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-[\w\[.\/-]+|(?:^|[\s:"'`!])(?:text-(?:left|right)|rounded-(?:l|r|tl|tr|bl|br)(?:-[\w\[\]-]+)?|border-(?:l|r)(?:-[\w\[\]-]+)?|float-(?:left|right)|clear-(?:left|right))(?=$|[\s"'`])/;
const CLASS_CALLEES = new Set(["cn", "clsx", "classNames", "cva", "twMerge", "tw"]);

function findPhysical(text) {
  const m = typeof text === "string" ? text.match(PHYSICAL_CLASS) : null;
  return m ? m[0].trim().replace(/^[:"'`!]/, "") : null;
}

const halaqyPlugin = {
  rules: {
    "no-physical-direction": {
      meta: {
        type: "suggestion",
        docs: { description: "Prefer logical (RTL-safe) Tailwind classes over left/right ones" },
        messages: {
          physical:
            "Physical-direction class \"{{cls}}\" breaks RTL. Use a logical class (ms-/me-/ps-/pe-/start-/end-, text-start/end, rounded-s/e, border-s/e).",
        },
        schema: [],
      },
      create(context) {
        const check = (node, text) => {
          const cls = findPhysical(text);
          if (cls) context.report({ node, messageId: "physical", data: { cls } });
        };
        const inClassContext = (node) => {
          for (let p = node.parent; p; p = p.parent) {
            if (p.type === "JSXAttribute") return /^(className|class)$/.test(p.name?.name ?? "");
            if (p.type === "CallExpression") {
              const callee = p.callee.type === "Identifier" ? p.callee.name : null;
              return callee !== null && CLASS_CALLEES.has(callee);
            }
            if (p.type === "Program" || p.type.startsWith("Function") || p.type === "ArrowFunctionExpression") return false;
          }
          return false;
        };
        return {
          Literal(node) {
            if (typeof node.value === "string" && inClassContext(node)) check(node, node.value);
          },
          TemplateElement(node) {
            if (inClassContext(node)) check(node, node.value.raw);
          },
        };
      },
    },
  },
};

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
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    plugins: { halaqy: halaqyPlugin },
    rules: { "halaqy/no-physical-direction": "warn" },
  },
  // Playwright fixtures receive a `use` callback that is not React's use().
  {
    files: ["e2e/**/*.{ts,tsx}"],
    rules: { "react-hooks/rules-of-hooks": "off" },
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
    // Vendored third-party bundles (maplibre-gl worker).
    "public/vendor/**",
    // Supabase CLI scratch (generated edge-runtime bundle).
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
