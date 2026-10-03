import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";

const READER_PROTOCOL = 1;

function configuredSite(): URL {
  const raw = process.env.EDITORIAL_PUBLIC_SITE_URL;
  if (!raw) throw new Error("EDITORIAL_PUBLIC_SITE_URL is missing.");
  const site = new URL(raw);
  const local = site.protocol === "http:" && ["localhost", "127.0.0.1"].includes(site.hostname);
  if (!(site.protocol === "https:" && site.hostname === "www.weekendmvp.app") && !local) {
    throw new Error("Editorial public site must be the canonical HTTPS host or local loopback.");
  }
  if (site.username || site.password || site.search || site.hash || site.pathname !== "/") {
    throw new Error("Editorial public site must be a bare origin.");
  }
  return site;
}

async function probeReader(site: URL): Promise<void> {
  const expectedCommit = process.env.EDITORIAL_READER_COMMIT;
  if (!expectedCommit || !/^[a-z0-9-]{7,64}$/i.test(expectedCommit)) {
    throw new Error("EDITORIAL_READER_COMMIT is missing or invalid.");
  }
  const response = await fetch(new URL("/api/editorial/reader-health", site), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Public reader health returned ${response.status}.`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" ||
      (body as Record<string, unknown>).protocol !== READER_PROTOCOL ||
      (body as Record<string, unknown>).commit !== expectedCommit) {
    throw new Error("The deployed public reader does not match the expected protocol and commit.");
  }
}

async function probeRemoval(site: URL, slug: string): Promise<void> {
  const route = await fetch(new URL(`/ideas/${encodeURIComponent(slug)}`, site), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (route.status !== 404) throw new Error(`Removed idea still returned HTTP ${route.status}.`);
  const sitemap = await fetch(new URL("/sitemap.xml", site), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!sitemap.ok || (await sitemap.text()).includes(`/ideas/${slug}</loc>`)) {
    throw new Error("Removed idea is still present in the sitemap or sitemap is unavailable.");
  }
}

async function probePublished(site: URL, slug: string, artifactHash: string): Promise<void> {
  const response = await fetch(new URL(`/ideas/${encodeURIComponent(slug)}`, site), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 200) throw new Error(`Released idea returned HTTP ${response.status}.`);
  const html = await response.text();
  if (!html.includes(`data-editorial-artifact-hash="${artifactHash}"`)) {
    throw new Error("Public page did not render the activated artifact.");
  }
}

async function advance(ctx: ActionCtx, releaseId: string, expectedState: "preparing" | "publish_requested" | "deploying" | "verifying" | "activating" | "verifying_public") {
  return ctx.runMutation(internal.editorial.service.workerAdvance, {
    releaseId,
    expectedState,
    report: { kind: "completed" },
  });
}

/** One durable, idempotent run; the recovery cron resumes jobs after a crash. */
async function processRelease(ctx: ActionCtx, releaseId: string): Promise<void> {
  for (let step = 0; step < 5; step += 1) {
    const item = await ctx.runQuery(internal.editorial.service.workerItem, { releaseId });
    if (!item) return;
    try {
      if (item.operation !== "unpublish" && !item.staged) throw new Error("Approved artifact was not staged.");
      if (item.state === "preparing" || item.state === "publish_requested") {
        const result = await advance(ctx, releaseId, item.state);
        if (!result.moved) return;
        continue;
      }
      const site = configuredSite();
      await probeReader(site);
      if (item.operation === "unpublish") await probeRemoval(site, item.slug);
      if (item.state === "verifying_public") {
        if (!item.artifactHash) throw new Error("Activated artifact hash is missing.");
        await probePublished(site, item.slug, item.artifactHash);
      }
      const result = await advance(ctx, releaseId, item.state);
      if (!result.moved) return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Release worker failed.";
      await ctx.runMutation(internal.editorial.service.workerAdvance, {
        releaseId,
        expectedState: item.state,
        report: { kind: "failed", code: "RELEASE_WORKER_FAILED", message },
      });
      return;
    }
  }
}

export const run = internalAction({
  args: { releaseId: v.string() },
  returns: v.null(),
  handler: async (ctx, { releaseId }) => {
    await processRelease(ctx, releaseId);
    return null;
  },
});

export const recover = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const rows = await ctx.runQuery(internal.editorial.service.workerQueue, {});
    for (const row of rows.slice(0, 5)) await processRelease(ctx, row.releaseId);
    return null;
  },
});
