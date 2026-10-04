#!/usr/bin/env node

/** Keep the production Convex reader ahead of the Vercel frontend deployment. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LIVE_CONVEX_URL = "https://first-squirrel-244.eu-west-1.convex.cloud";
const LIVE_DEPLOYMENT = "first-squirrel-244";

export function buildSteps(env) {
  const nextBuild = { command: "npm", args: ["run", "build"] };
  if (env.VERCEL_ENV !== "production") return [nextBuild];

  const key = env.CONVEX_DEPLOY_KEY;
  const keyPrefix = `prod:${LIVE_DEPLOYMENT}|`;
  if (typeof key !== "string" || !key.startsWith(keyPrefix) || key.length === keyPrefix.length) {
    throw new Error(`Production build requires a deploy key scoped to ${LIVE_DEPLOYMENT}.`);
  }
  if (env.NEXT_PUBLIC_CONVEX_URL !== LIVE_CONVEX_URL) {
    throw new Error(`Production build requires NEXT_PUBLIC_CONVEX_URL=${LIVE_CONVEX_URL}.`);
  }

  const deploymentEnv = { ...env };
  delete deploymentEnv.CONVEX_DEPLOYMENT;
  const frontendEnv = { ...deploymentEnv };
  delete frontendEnv.CONVEX_DEPLOY_KEY;
  return [
    {
      command: "node",
      args: ["scripts/generate-idea-slugs.mjs", "--check"],
      env: frontendEnv,
    },
    {
      command: "npx",
      args: ["convex", "deploy", "--typecheck", "enable", "--message", `Vercel production ${env.VERCEL_GIT_COMMIT_SHA ?? "manual"}`],
      env: deploymentEnv,
    },
    { ...nextBuild, env: frontendEnv },
  ];
}

export function runBuild(steps, runner = spawnSync) {
  for (const step of steps) {
    const result = runner(step.command, step.args, { env: step.env ?? process.env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${step.command} ${step.args.slice(0, 2).join(" ")} failed; frontend build stopped.`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runBuild(buildSteps(process.env));
}
