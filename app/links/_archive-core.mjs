export const CATEGORY_LABELS = Object.freeze({
  "ai-automation": "AI & Automation",
  "creator-tools": "Creator Tools",
  finance: "Finance",
  ecommerce: "Ecommerce",
  "marketing-sales": "Marketing & Sales",
  productivity: "Productivity",
  "developer-tools": "Developer Tools",
  "local-business": "Local Business",
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_FIELDS = [
  "date",
  "day",
  "slug",
  "title",
  "format",
  "category",
  "source_url",
];

export function parseCsvLine(line) {
  const cells = [];
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

export function parseCampaignCsv(raw, campaignSlug) {
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
    );

    if (
      REQUIRED_FIELDS.some((field) => !row[field]) ||
      !ISO_DATE.test(row.date) ||
      !Object.hasOwn(CATEGORY_LABELS, row.category)
    ) {
      return [];
    }

    let pathname;
    try {
      pathname = new URL(row.source_url).pathname.replace(/\/$/, "");
    } catch {
      return [];
    }

    const kind = pathname.startsWith("/articles/")
      ? "article"
      : pathname.startsWith("/ideas/")
        ? "idea"
        : null;
    if (!kind) return [];

    return [{ ...row, campaignSlug, pathname, kind }];
  });
}

export function selectReleasedRows(rows, currentDate) {
  if (!ISO_DATE.test(currentDate)) return [];

  const seenPaths = new Set();
  return [...rows]
    .filter((row) => row.date <= currentDate)
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) || left.slug.localeCompare(right.slug),
    )
    .filter((row) => {
      if (seenPaths.has(row.pathname)) return false;
      seenPaths.add(row.pathname);
      return true;
    });
}

export function filterReleasedRows(rows, filters = {}) {
  const query = (filters.query ?? "").trim().toLocaleLowerCase("en-GB");

  return rows.filter((row) => {
    if (query && !row.title.toLocaleLowerCase("en-GB").includes(query)) {
      return false;
    }
    if (filters.category && row.category !== filters.category) return false;
    if (filters.format && row.format !== filters.format) return false;
    return true;
  });
}

export function paginateReleasedRows(rows, requestedPage, pageSize = 8) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const parsedPage = Number.parseInt(String(requestedPage), 10);
  const page = Math.min(
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    totalPages,
  );
  const visibleCount = Math.min(rows.length, page * pageSize);
  const remainingCount = rows.length - visibleCount;

  return {
    items: rows.slice(0, visibleCount),
    page,
    pageSize,
    totalCount: rows.length,
    visibleCount,
    remainingCount,
    nextBatchSize: Math.min(pageSize, remainingCount),
    hasMore: remainingCount > 0,
  };
}
