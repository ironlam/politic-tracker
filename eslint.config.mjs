import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated files:
    "src/generated/**",
    // Scripts (not part of the app):
    "scripts/**",
    // Git worktrees (contain their own .next/build artifacts):
    ".worktrees/**",
  ]),
  {
    rules: {
      "no-console": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Allow console in server-side code (API routes, sync services, CLI utilities)
  {
    files: [
      "src/app/api/**/*.ts",
      "src/services/**/*.ts",
      "src/lib/sync/**/*.ts",
      "src/lib/api/**/*.ts",
      "src/lib/auth.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
