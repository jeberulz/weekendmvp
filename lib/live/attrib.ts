/**
 * First-touch live attribution for Luma register links.
 * Captures utm_* (and src/placement aliases) from the page URL into
 * sessionStorage so /live → /live/48-hours keeps the tag.
 */

export const LIVE_ATTRIB_KEY = "wmvp-live-attrib";

export type LiveAttrib = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export function readLiveAttribFromSearch(
  search: string,
  defaults?: { campaign?: string },
): LiveAttrib {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const out: LiveAttrib = {};

  const source = params.get("utm_source") || params.get("src");
  if (source) out.utm_source = source;

  const medium = params.get("utm_medium");
  if (medium) out.utm_medium = medium;

  const campaign =
    params.get("utm_campaign") || defaults?.campaign || undefined;
  if (campaign) out.utm_campaign = campaign;

  const content = params.get("utm_content") || params.get("placement");
  if (content) out.utm_content = content;

  const term = params.get("utm_term");
  if (term) out.utm_term = term;

  return out;
}

export function hasLiveAttrib(attrib: LiveAttrib): boolean {
  return UTM_KEYS.some((k) => Boolean(attrib[k]));
}

export function loadStoredLiveAttrib(): LiveAttrib {
  try {
    const raw = sessionStorage.getItem(LIVE_ATTRIB_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LiveAttrib;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist first-touch only — never overwrite an existing tag. */
export function persistLiveAttrib(attrib: LiveAttrib): void {
  if (!hasLiveAttrib(attrib)) return;
  try {
    if (sessionStorage.getItem(LIVE_ATTRIB_KEY)) return;
    sessionStorage.setItem(LIVE_ATTRIB_KEY, JSON.stringify(attrib));
  } catch {
    /* ignore */
  }
}

export function resolveLiveAttrib(search: string, campaignDefault: string): LiveAttrib {
  const fromUrl = readLiveAttribFromSearch(search, {
    campaign: campaignDefault,
  });
  if (hasLiveAttrib(fromUrl)) {
    // Ensure campaign default when only src/placement aliases were present.
    if (!fromUrl.utm_campaign) fromUrl.utm_campaign = campaignDefault;
    persistLiveAttrib(fromUrl);
    return fromUrl;
  }
  const stored = loadStoredLiveAttrib();
  if (hasLiveAttrib(stored)) return stored;
  return {};
}

/** Append resolved UTMs onto a bare Luma (or other) URL. */
export function appendLiveAttribToUrl(
  baseUrl: string,
  attrib: LiveAttrib,
): string {
  if (!baseUrl || !hasLiveAttrib(attrib)) return baseUrl;
  try {
    const url = new URL(baseUrl);
    for (const key of UTM_KEYS) {
      const value = attrib[key];
      if (value && !url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}
