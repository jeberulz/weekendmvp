import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildSteps, runBuild } from "../../scripts/vercel-build.mjs";

const live = {
  VERCEL_ENV: "production",
  CONVEX_DEPLOY_KEY: "prod:first-squirrel-244|test-only-key",
  CONVEX_DEPLOYMENT: "prod:vibrant-jackal-308",
  NEXT_PUBLIC_CONVEX_URL: "https://first-squirrel-244.eu-west-1.convex.cloud",
  VERCEL_GIT_COMMIT_SHA: "abc123",
};

test("Vercel invokes the ordered build script", () => {
  const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.buildCommand, "node scripts/vercel-build.mjs");
});

test("production refuses missing or wrong-target credentials before running commands", () => {
  for (const changed of [
    { CONVEX_DEPLOY_KEY: undefined },
    { CONVEX_DEPLOY_KEY: "prod:vibrant-jackal-308|wrong-target" },
    { CONVEX_DEPLOY_KEY: "preview:weekendmvp|wrong-scope" },
    { NEXT_PUBLIC_CONVEX_URL: "https://vibrant-jackal-308.convex.cloud" },
  ]) {
    assert.throws(() => buildSteps({ ...live, ...changed }), /Production build requires/);
  }
});

test("production deploys the exact backend first and never builds after a failed deploy", () => {
  const steps = buildSteps(live);
  assert.equal(steps[0].command, "npx");
  assert.deepEqual(steps[0].args.slice(0, 2), ["convex", "deploy"]);
  assert.equal(steps[0].env.CONVEX_DEPLOYMENT, undefined);
  assert.equal(steps[1].command, "npm");
  assert.equal(steps[1].env.CONVEX_DEPLOY_KEY, undefined);
  const calls = [];
  assert.throws(() => runBuild(steps, (command) => {
    calls.push(command);
    return { status: 1 };
  }), /frontend build stopped/);
  assert.deepEqual(calls, ["npx"]);
  runBuild(steps, (command) => {
    calls.push(command);
    return { status: 0 };
  });
  assert.deepEqual(calls.slice(1), ["npx", "npm"]);
});

test("preview and local builds never deploy Convex", () => {
  for (const env of [{ VERCEL_ENV: "preview" }, {}]) {
    assert.deepEqual(buildSteps(env), [{ command: "npm", args: ["run", "build"] }]);
  }
});
