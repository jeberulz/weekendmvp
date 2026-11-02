import { existsSync } from "node:fs";
import path from "node:path";

import type { LiveSession } from "@/lib/live/sessions";
import { LIVE_SESSION_RESERVED_SLUGS } from "@/lib/live/sessions";

/** ISO-8601 instant with an explicit offset (`Z` or `±HH:MM`). */
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const YOUTUBE_ID = /^[\w-]{11}$/;

const LUMA_HOST = /^(?:www\.)?(?:luma\.com|lu\.ma)$/i;

export type SessionValidationIssue = {
  sessionId: string | "(list)";
  message: string;
};

function isIsoWithOffset(value: string): boolean {
  if (!ISO_WITH_OFFSET.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function isLumaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return LUMA_HOST.test(url.hostname) && url.protocol === "https:";
  } catch {
    return false;
  }
}

function thumbnailExists(thumbnail: string, cwd: string): boolean {
  const rel = thumbnail.startsWith("/") ? thumbnail.slice(1) : thumbnail;
  return existsSync(path.join(cwd, "public", rel));
}

/**
 * Validate one session. Clock-free — never asserts against Date.now().
 */
export function validateSession(
  session: LiveSession,
  opts: {
    ideaSlugs: ReadonlySet<string>;
    cwd?: string;
  },
): SessionValidationIssue[] {
  const issues: SessionValidationIssue[] = [];
  const id = session.id;
  const cwd = opts.cwd ?? process.cwd();

  const push = (message: string) => issues.push({ sessionId: id, message });

  if (!session.id.trim()) push("id is required");
  if (!session.slug.trim()) push("slug is required");
  if (
    (LIVE_SESSION_RESERVED_SLUGS as readonly string[]).includes(session.slug)
  ) {
    push(`slug "${session.slug}" is reserved`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(session.slug)) {
    push(`slug "${session.slug}" must be lowercase kebab-case`);
  }
  if (!session.ideaSlug.trim()) push("ideaSlug is required");
  else if (!opts.ideaSlugs.has(session.ideaSlug)) {
    push(`ideaSlug "${session.ideaSlug}" is missing from ideas/manifest.json`);
  }
  if (!session.ideaName.trim()) push("ideaName is required");
  if (!session.title.trim()) push("title is required");
  if (!session.oneLiner.trim()) push("oneLiner is required");
  if (session.kind !== "free") push('kind must be "free"');
  if (!session.category.trim()) push("category is required");
  if (session.timezone !== "Europe/London") {
    push('timezone must be "Europe/London"');
  }

  if (!isIsoWithOffset(session.startsAt)) {
    push(`startsAt must be ISO-8601 with an explicit offset (got "${session.startsAt}")`);
  }
  if (!isIsoWithOffset(session.endsAt)) {
    push(`endsAt must be ISO-8601 with an explicit offset (got "${session.endsAt}")`);
  }
  if (isIsoWithOffset(session.startsAt) && isIsoWithOffset(session.endsAt)) {
    if (Date.parse(session.endsAt) <= Date.parse(session.startsAt)) {
      push("endsAt must be after startsAt");
    }
  }
  if (!isIsoWithOffset(session.updatedAt)) {
    push(`updatedAt must be ISO-8601 with an explicit offset (got "${session.updatedAt}")`);
  }

  if (session.status !== "draft") {
    if (!session.lumaUrl.trim()) {
      push("lumaUrl is required unless status is draft");
    } else if (!isLumaUrl(session.lumaUrl)) {
      push(`lumaUrl must be an https luma.com / lu.ma URL (got "${session.lumaUrl}")`);
    }
  } else if (session.lumaUrl.trim() && !isLumaUrl(session.lumaUrl)) {
    push(`lumaUrl must be an https luma.com / lu.ma URL (got "${session.lumaUrl}")`);
  }

  if (session.youtubeId !== undefined) {
    if (!YOUTUBE_ID.test(session.youtubeId)) {
      push(`youtubeId must match ^[\\w-]{11}$ (got "${session.youtubeId}")`);
    }
    if (!session.durationIso?.trim()) {
      push("durationIso is required when youtubeId is set");
    } else if (!/^PT(?:\d+H)?(?:\d+M)?(?:\d+S)?$/.test(session.durationIso)) {
      push(`durationIso must be ISO-8601 duration (got "${session.durationIso}")`);
    }
  }

  if (session.replayPublishedAt !== undefined && !isIsoWithOffset(session.replayPublishedAt)) {
    push(
      `replayPublishedAt must be ISO-8601 with an explicit offset (got "${session.replayPublishedAt}")`,
    );
  }

  if (session.thumbnail) {
    if (!session.thumbnail.startsWith("/image/")) {
      push(`thumbnail must be a /image/… path (got "${session.thumbnail}")`);
    } else if (!thumbnailExists(session.thumbnail, cwd)) {
      push(`thumbnail file missing at public${session.thumbnail}`);
    }
  }

  if (session.status !== undefined) {
    const allowed: LiveSession["status"][] = ["cancelled", "postponed", "draft"];
    if (!allowed.includes(session.status)) {
      push(`status "${String(session.status)}" is not allowed`);
    }
  }

  return issues;
}

/** List-level checks (uniqueness) plus per-session rules. */
export function validateSessions(
  sessions: readonly LiveSession[],
  opts: {
    ideaSlugs: ReadonlySet<string>;
    cwd?: string;
  },
): SessionValidationIssue[] {
  const issues: SessionValidationIssue[] = [];
  const ids = new Map<string, number>();
  const slugs = new Map<string, number>();

  for (const session of sessions) {
    ids.set(session.id, (ids.get(session.id) ?? 0) + 1);
    slugs.set(session.slug, (slugs.get(session.slug) ?? 0) + 1);
    issues.push(...validateSession(session, opts));
  }

  for (const [id, count] of ids) {
    if (count > 1) {
      issues.push({ sessionId: "(list)", message: `duplicate id "${id}"` });
    }
  }
  for (const [slug, count] of slugs) {
    if (count > 1) {
      issues.push({ sessionId: "(list)", message: `duplicate slug "${slug}"` });
    }
  }

  return issues;
}

export function loadIdeaSlugsFromManifest(
  manifest: { ideas: readonly { slug: string }[] },
): Set<string> {
  return new Set(manifest.ideas.map((idea) => idea.slug));
}
