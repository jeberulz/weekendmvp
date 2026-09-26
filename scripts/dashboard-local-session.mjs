/**
 * Issue an email-confirmation fixture in the disposable WP44 local backend.
 * Uses the installed auth store to hash/store the code; the browser redeems
 * it through the normal /email-signin flow. No delivery provider is called.
 *
 * node scripts/dashboard-local-session.mjs --confirm-disposable=wp44 \
 *   --email=member-a@example.test --output=.convex/local/member-a.json
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const options = new Map(process.argv.slice(2).map((arg) => {
  const at = arg.indexOf("=");
  return [arg.slice(0, at), arg.slice(at + 1)];
}));

async function main() {
  if (options.get("--confirm-disposable") !== "wp44") throw new Error("Disposable acknowledgement required");
  const config = JSON.parse(await readFile(".convex/local/default/config.json", "utf8"));
  // Deliberately exclude the shared local ports and every cloud URL. Never
  // read CONVEX_DEPLOYMENT, CONVEX_DEPLOY_KEY or .env files in this fixture.
  if (config.ports?.cloud !== 3310 || config.ports?.site !== 3311) throw new Error("Wrong local ports");
  const email = options.get("--email") ?? "wp44-member@example.test";
  if (!/^[a-z0-9.+_-]+@example\.test$/.test(email)) throw new Error("Synthetic email required");
  const output = path.resolve(options.get("--output") ?? ".convex/local/dashboard-session.json");
  const localRoot = path.resolve(".convex/local") + path.sep;
  if (!output.startsWith(localRoot)) throw new Error("Output must remain in ignored local state");
  const code = randomBytes(32).toString("hex");
  const client = new ConvexHttpClient("http://127.0.0.1:3310", { logger: false });
  client.setAdminAuth(config.adminKey);
  await client.mutation(makeFunctionReference("auth:store"), {
    args: {
      type: "createVerificationCode", provider: "email", email, code,
      expirationTime: Date.now() + 15 * 60 * 1000, allowExtraProviders: false,
    },
  });
  const url = new URL("http://localhost:3188/email-signin");
  url.searchParams.set("token", code);
  url.searchParams.set("email", email);
  url.searchParams.set("returnTo", "/dashboard/saved");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ email, confirmationUrl: url.toString() }, null, 2) + "\n", { mode: 0o600 });
  process.stdout.write(`Local confirmation fixture written to ${path.relative(process.cwd(), output)}\n`);
}

main().catch(() => {
  // Provider errors may contain credential material; don't print raw errors.
  process.stderr.write("Local fixture failed. Check disposable ports 3310/3311, local config, synthetic email and acknowledgement.\n");
  process.exitCode = 1;
});
