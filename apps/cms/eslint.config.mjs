import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // No anonymous functions in render: a JSX prop takes a named handler (or
      // a named-factory call), never an inline arrow/function literal. Targeted
      // syntax selectors instead of react/jsx-no-bind — that rule also rejects
      // every locally-declared handler, which would force useCallback noise.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute > JSXExpressionContainer > ArrowFunctionExpression",
          message: "No anonymous functions in render: extract a named handler.",
        },
        {
          selector: "JSXAttribute > JSXExpressionContainer > FunctionExpression",
          message: "No anonymous functions in render: extract a named handler.",
        },
      ],
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
