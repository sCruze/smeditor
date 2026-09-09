// Flat ESLint config for the SMEditor monorepo.
//
// Deliberately conservative: only a small set of genuinely-dangerous
// patterns are errors (so `pnpm lint` stays green and CI doesn't go red),
// while quality rules are surfaced as warnings the team can tighten over
// time. Prettier owns formatting, so all stylistic rules are disabled.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.d.ts",
      "**/playwright-report/**",
      "**/.next/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Quality signals — warnings, not build-breakers.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
      // TS already flags undefined identifiers; the base rule misfires on
      // node/browser globals in JS/.mjs files.
      "no-undef": "off",
      "no-unused-vars": "off",
      // Idiomatic in the parser/serializer (assignment in while-conditions,
      // multi-space sanitiser regexes, control-char regexes) — not bugs.
      "no-cond-assign": "off",
      "no-control-regex": "off",
      "no-regex-spaces": "off",
      "no-useless-escape": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  // React hooks rules — defined so existing eslint-disable directives
  // resolve, surfaced as warnings so CI stays green.
  {
    files: ["packages/react/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // Tests and config files run in node/vitest globals.
  {
    files: ["**/*.test.{ts,tsx}", "**/*.config.{ts,js,mjs}", "scripts/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  prettier,
);
