import fs from "node:fs/promises";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";

import {
  CATEGORY_LABELS,
  parseCampaignCsv,
  selectReleasedRows,
} from "./_archive-core.mjs";

const CAMPAIGNS_DIRECTORY = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "content/social/reels/campaigns",
);
const FALLBACK_IMAGE = "/image/og-image.png";

type CampaignRow = {
  date: string;
  day: string;
  slug: string;
  title: string;
  format: string;
  category: string;
  source_url: string;
  campaignSlug: string;
  pathname: string;
  kind: "idea" | "article";
};

export type VideoLink = {
  isoDate: string;
  date: string;
  day: string;
  slug: string;
  title: string;
  format: string;
  category: string;
  categoryLabel: string;
  href: string;
  image: string;
  kind: "idea" | "article";
};

export const CATEGORY_OPTIONS: ReadonlyArray<{
  slug: string;
  label: string;
}> = Object.entries(CATEGORY_LABELS).map(([slug, label]) => ({ slug, label }));

const categoryLabels = CATEGORY_LABELS as Readonly<Record<string, string>>;

function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

async function imageFor(pathname: string, slug: string): Promise<string> {
  const directory = pathname.startsWith("/articles/") ? "article" : "idea";
  const image = `/image/og/${directory}/${slug}.png`;

  try {
    await fs.access(path.join(process.cwd(), "public", image));
    return image;
  } catch {
    return FALLBACK_IMAGE;
  }
}

function trackedHref(
  pathname: string,
  slug: string,
  campaignSlug: string,
): string {
  const params = new URLSearchParams({
    utm_source: "link_in_bio",
    utm_medium: "social",
    utm_campaign: campaignSlug,
    utm_content: slug,
  });
  return `${pathname}?${params.toString()}`;
}

async function campaignCalendarFiles(): Promise<
  Array<{ campaignSlug: string; filename: string }>
> {
  const entries = await fs.readdir(CAMPAIGNS_DIRECTORY, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      campaignSlug: entry.name,
      filename: path.join(CAMPAIGNS_DIRECTORY, entry.name, "calendar.csv"),
    }))
    .sort((left, right) => left.filename.localeCompare(right.filename));
}

export async function getReleasedVideoLinks(
  currentDate: string,
): Promise<VideoLink[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("social-video-links");

  try {
    const calendars = await campaignCalendarFiles();
    const parsedCalendars = await Promise.all(
      calendars.map(async ({ campaignSlug, filename }) => {
        try {
          return parseCampaignCsv(
            await fs.readFile(filename, "utf8"),
            campaignSlug,
          ) as CampaignRow[];
        } catch {
          return [];
        }
      }),
    );
    const releasedRows = selectReleasedRows(
      parsedCalendars.flat(),
      currentDate,
    ) as CampaignRow[];

    return Promise.all(
      releasedRows.map(async (row) => ({
        isoDate: row.date,
        date: formatDate(row.date, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        day: row.day,
        slug: row.slug,
        title: row.title,
        format: row.format,
        category: row.category,
        categoryLabel: categoryLabels[row.category] ?? row.category,
        href: trackedHref(row.pathname, row.slug, row.campaignSlug),
        image: await imageFor(row.pathname, row.slug),
        kind: row.kind,
      })),
    );
  } catch {
    return [];
  }
}
