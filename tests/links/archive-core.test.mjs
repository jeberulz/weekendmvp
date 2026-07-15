import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  filterReleasedRows,
  paginateReleasedRows,
  parseCampaignCsv,
  selectReleasedRows,
} from "../../app/links/_archive-core.mjs";

const HEADER =
  "date,day,week,slug,title,format,category,objective,reel_time,linkedin,linkedin_time,newsletter,status,source_url";

function row({
  date,
  slug,
  title,
  format = "idea-breakdown",
  category = "ai-automation",
  status = "scripted",
  source = `https://www.weekendmvp.app/ideas/${slug}`,
}) {
  return `${date},Mon,1,${slug},${title},${format},${category},reach,18:30,no,,no,${status},${source}`;
}

test("CSV parsing handles quoted titles and controlled categories", () => {
  const parsed = parseCampaignCsv(
    `${HEADER}\n${row({ date: "2026-07-14", slug: "quoted", title: '"Tools, Teams, and AI"' })}`,
    "campaign-one",
  );

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "Tools, Teams, and AI");
  assert.equal(parsed[0].campaignSlug, "campaign-one");
});

test("released selection hides future rows and ignores operational status", () => {
  const parsed = parseCampaignCsv(
    [
      HEADER,
      row({
        date: "2026-07-13",
        slug: "yesterday",
        title: "Yesterday",
        status: "published",
      }),
      row({
        date: "2026-07-14",
        slug: "today",
        title: "Today",
        status: "recorded",
      }),
      row({
        date: "2026-07-15",
        slug: "tomorrow",
        title: "Tomorrow",
        status: "published",
      }),
    ].join("\n"),
    "campaign-one",
  );

  const released = selectReleasedRows(parsed, "2026-07-14");
  assert.deepEqual(
    released.map((entry) => entry.slug),
    ["today", "yesterday"],
  );
});

test("duplicate canonical destinations retain the newest release record", () => {
  const older = parseCampaignCsv(
    `${HEADER}\n${row({ date: "2026-07-10", slug: "repeat", title: "Older" })}`,
    "campaign-one",
  );
  const newer = parseCampaignCsv(
    `${HEADER}\n${row({ date: "2026-07-14", slug: "repeat", title: "Newer" })}`,
    "campaign-two",
  );

  const released = selectReleasedRows([...older, ...newer], "2026-07-14");
  assert.equal(released.length, 1);
  assert.equal(released[0].title, "Newer");
  assert.equal(released[0].campaignSlug, "campaign-two");
});

test("search, category, and format filters combine", () => {
  const parsed = parseCampaignCsv(
    [
      HEADER,
      row({
        date: "2026-07-14",
        slug: "creator-ai",
        title: "AI Script Studio",
        format: "three-screen-mvp",
        category: "creator-tools",
      }),
      row({
        date: "2026-07-13",
        slug: "finance-ai",
        title: "AI Tax Helper",
        format: "three-screen-mvp",
        category: "finance",
      }),
    ].join("\n"),
    "campaign-one",
  );

  const filtered = filterReleasedRows(parsed, {
    query: "script",
    category: "creator-tools",
    format: "three-screen-mvp",
  });
  assert.deepEqual(filtered.map((entry) => entry.slug), ["creator-ai"]);
});

test("pagination reveals cumulative batches for boundary counts", () => {
  for (const total of [0, 1, 8, 9, 16, 17]) {
    const rows = Array.from({ length: total }, (_, index) => ({ index }));
    const first = paginateReleasedRows(rows, 1);
    assert.equal(first.visibleCount, Math.min(total, 8));
    assert.equal(first.hasMore, total > 8);

    const finalPage = Math.max(1, Math.ceil(total / 8));
    const final = paginateReleasedRows(rows, finalPage);
    assert.equal(final.visibleCount, total);
    assert.equal(final.hasMore, false);
  }
});

test("the active campaign calendar has a valid category on every row", async () => {
  const calendar = await readFile(
    path.join(
      process.cwd(),
      "content/social/reels/campaigns/2026-07-audience-growth/calendar.csv",
    ),
    "utf8",
  );
  const parsed = parseCampaignCsv(calendar, "2026-07-audience-growth");
  const sourceRows = calendar.trim().split(/\r?\n/).length - 1;

  assert.equal(parsed.length, sourceRows);
});
