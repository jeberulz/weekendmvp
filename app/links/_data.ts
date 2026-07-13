import fs from "node:fs/promises";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";

const CAMPAIGN_SLUG = "2026-07-audience-growth";
const CAMPAIGN_FILE = path.join(
  process.cwd(),
  "content/social/reels/campaigns",
  CAMPAIGN_SLUG,
  "calendar.csv",
);
const FALLBACK_IMAGE = "/image/og-image.png";

type CampaignRow = {
  date: string;
  day: string;
  week: string;
  slug: string;
  title: string;
  format: string;
  source_url: string;
};

export type VideoLink = {
  date: string;
  day: string;
  title: string;
  format: string;
  href: string;
  image: string;
  kind: "idea" | "article";
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCampaignCsv(raw: string): CampaignRow[] {
  const [headerLine, ...lines] = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!headerLine) return [];

  const headers = parseCsvLine(headerLine);
  return lines.flatMap((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    ) as CampaignRow;

    if (
      !row.date ||
      !row.day ||
      !row.week ||
      !row.slug ||
      !row.title ||
      !row.source_url
    ) {
      return [];
    }

    return [row];
  });
}

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

function trackedHref(pathname: string, slug: string): string {
  const params = new URLSearchParams({
    utm_source: "link_in_bio",
    utm_medium: "social",
    utm_campaign: CAMPAIGN_SLUG,
    utm_content: slug,
  });
  return `${pathname}?${params.toString()}`;
}

export async function getVideoLinkForDate(
  scheduledDate: string,
): Promise<VideoLink | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("social-video-links");

  try {
    const rows = parseCampaignCsv(await fs.readFile(CAMPAIGN_FILE, "utf8"));
    const row = rows.find((candidate) => candidate.date === scheduledDate);
    if (!row) return null;

    let pathname: string;
    try {
      pathname = new URL(row.source_url).pathname.replace(/\/$/, "");
    } catch {
      return null;
    }

    const kind = pathname.startsWith("/articles/")
      ? "article"
      : pathname.startsWith("/ideas/")
        ? "idea"
        : null;
    if (!kind) return null;

    return {
      date: formatDate(row.date, {
        day: "numeric",
        month: "short",
      }),
      day: row.day,
      title: row.title,
      format: row.format,
      href: trackedHref(pathname, row.slug),
      image: await imageFor(pathname, row.slug),
      kind,
    };
  } catch {
    return null;
  }
}
