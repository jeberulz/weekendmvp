import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

const accessibilityRules = [
  "jsx-a11y/alt-text",
  "jsx-a11y/aria-props",
  "jsx-a11y/aria-proptypes",
  "jsx-a11y/aria-unsupported-elements",
  "jsx-a11y/role-has-required-aria-props",
  "jsx-a11y/role-supports-aria-props",
];

test("configured JSX accessibility rules are errors", async () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const config = await eslint.calculateConfigForFile("app/layout.tsx");

  for (const rule of accessibilityRules) {
    assert.equal(config.rules[rule][0], 2, `${rule} must fail lint and CI`);
  }
});

test("an image without alt text fails the lint gate", async () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(
    'export default function Probe() { return <img src="/probe.png" />; }',
    { filePath: "tests/security/accessibility-probe.tsx" },
  );

  assert.ok(result.errorCount > 0);
  assert.ok(
    result.messages.some(
      (message) =>
        message.ruleId === "jsx-a11y/alt-text" && message.severity === 2,
    ),
  );
});
