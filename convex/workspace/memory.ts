import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertFeatureEnabled } from "../ops/settings";
import { requireBusinessAccess } from "../platform/authz";
import {
  WREN_MEMORY_FACT_MAX_CHARS,
  WREN_MEMORY_FACTS_MAX,
  WREN_MEMORY_SUMMARY_MAX_CHARS,
} from "../../lib/workspace/contracts/wrenMemory";
import type { FounderMemoryEdit } from "../../lib/workspace/wrenMemory";
import { applyFounderMemoryEdit, readWrenMemory } from "./wrenMemory";

/**
 * WP77-S5 — "What Wren knows" on the Files page: read Wren's memory, and let
 * the founder edit or delete a fact and edit or clear the summary.
 *
 * Every function: C-OPS `assertFeatureEnabled(ctx, "workspace")`, then C-AUTHZ
 * `requireBusinessAccess(ctx, projectId, "owner")`. Writes go through
 * `./wrenMemory.ts` (the only `wren_memory` writer), which cleans and bounds
 * the text and refuses scheme URLs, markup tags and role tags. The founder's
 * words are as trusted as their chat messages, so Wren's stricter note rules
 * (no domains, no instruction-like phrasing, provenance) do not apply here.
 * One `audit_events` row per change, without the text.
 *
 * Concurrency: a fact is addressed by its index plus the exact text the
 * founder was looking at (`expected`), the summary by its expected text. If
 * Wren or another tab changed it in between, the result is `stale`, nothing
 * is written, and the page shows the latest list (the query is live).
 */

/** Facts returned at most (the cap, with room for rows written before it). */
const FACTS_RETURNED_MAX = WREN_MEMORY_FACTS_MAX * 2;

export const wrenMemoryViewValidator = v.object({
  summary: v.string(),
  facts: v.array(v.string()),
  updatedAt: v.union(v.number(), v.null()),
  limits: v.object({ factsMax: v.number(), factMaxChars: v.number(), summaryMaxChars: v.number() }),
});

export type WrenMemoryView = Infer<typeof wrenMemoryViewValidator>;

const refusalCodeValidator = v.union(
  v.literal("empty"),
  v.literal("too_short"),
  v.literal("too_long"),
  v.literal("has_link"),
  v.literal("has_markup"),
  v.literal("has_role_tag"),
  v.literal("duplicate"),
);

export const memoryEditResultValidator = v.union(
  v.object({ kind: v.literal("saved") }),
  v.object({ kind: v.literal("unchanged") }),
  v.object({ kind: v.literal("stale") }),
  v.object({ kind: v.literal("refused"), code: refusalCodeValidator }),
);

export type MemoryEditResult = Infer<typeof memoryEditResultValidator>;

/** The result without the new state: the page reads that from the live query. */
function outcome(result: FounderMemoryEdit): MemoryEditResult {
  switch (result.kind) {
    case "saved":
      return { kind: "saved" };
    case "unchanged":
      return { kind: "unchanged" };
    case "stale":
      return { kind: "stale" };
    case "refused":
      return { kind: "refused", code: result.code };
  }
}

export const getWrenMemory = query({
  args: { projectId: v.id("projects") },
  returns: wrenMemoryViewValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const row = await readWrenMemory(ctx, { ownerId: project.ownerId, projectId: project._id });
    return {
      summary: row?.summary ?? "",
      facts: row === null ? [] : row.facts.slice(0, FACTS_RETURNED_MAX),
      updatedAt: row?.updatedAt ?? null,
      limits: {
        factsMax: WREN_MEMORY_FACTS_MAX,
        factMaxChars: WREN_MEMORY_FACT_MAX_CHARS,
        summaryMaxChars: WREN_MEMORY_SUMMARY_MAX_CHARS,
      },
    };
  },
});

export const editWrenMemoryFact = mutation({
  args: { projectId: v.id("projects"), index: v.number(), expected: v.string(), text: v.string() },
  returns: memoryEditResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    return outcome(await applyFounderMemoryEdit(ctx, { ownerId: project.ownerId, projectId: project._id }, {
      kind: "edit_fact", index: args.index, expected: args.expected, text: args.text,
    }));
  },
});

export const deleteWrenMemoryFact = mutation({
  args: { projectId: v.id("projects"), index: v.number(), expected: v.string() },
  returns: memoryEditResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    return outcome(await applyFounderMemoryEdit(ctx, { ownerId: project.ownerId, projectId: project._id }, {
      kind: "delete_fact", index: args.index, expected: args.expected,
    }));
  },
});

/** Edits the summary; empty text clears it. */
export const editWrenMemorySummary = mutation({
  args: { projectId: v.id("projects"), expected: v.string(), text: v.string() },
  returns: memoryEditResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    return outcome(await applyFounderMemoryEdit(ctx, { ownerId: project.ownerId, projectId: project._id }, {
      kind: "edit_summary", expected: args.expected, text: args.text,
    }));
  },
});
