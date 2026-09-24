/** Small text helpers for fitting idea copy into homepage tiles. */

/** Cut at a word boundary and add an ellipsis when `text` is longer than `max`. */
export function clamp(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:—–\-\s]+$/, "");
  return `${cut}…`;
}

/** Split prose into sentences. Only breaks before a capital or an opening quote. */
export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?][”"’)]?)\s+(?=[A-Z“"(])/)
    .filter(Boolean);
}

/** Up to `count` leading sentences that fit in `max` characters (always at least one, clamped). */
export function leadSentences(text: string, count: number, max: number): string {
  const parts = splitSentences(text);
  if (parts.length === 0) return "";
  let out = parts[0];
  for (const next of parts.slice(1, count)) {
    if (out.length + 1 + next.length > max) break;
    out = `${out} ${next}`;
  }
  return clamp(out, max);
}

/** "SlackToDoc: Turn Team Chatter…" → "SlackToDoc". */
export function shortTitle(title: string): string {
  return title.split(/\s*[:—–]\s+/)[0].trim();
}

/** "$15.81 billion" → "$15.81B". */
export function shortNumber(value: string): string {
  const units: Record<string, string> = { billion: "B", million: "M", trillion: "T" };
  return value.replace(/\s*(billion|million|trillion)\b/gi, (_, unit: string) => units[unit.toLowerCase()]);
}

/** Strip markdown emphasis and links. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

/** "Next.js 14 + Vercel", "Postgres via Supabase" → short tech-stack chips. */
export function stackChips(stack: string[], limit = 8): string[] {
  const out: string[] = [];
  for (const item of stack) {
    const bare = item.replace(/\s*\([^)]*\)/g, "");
    for (const raw of bare.split(/\s+\+\s+|\s+and\s+|\s*,\s*/)) {
      const part = raw.includes(" via ") ? raw.split(" via ")[1] : raw.split(/\s+or\s+/)[0];
      const chip = part.trim();
      if (chip && chip.length <= 26 && !out.includes(chip)) out.push(chip);
    }
  }
  return out.slice(0, limit);
}

/** "Free — Algorithm Health Quiz" → "Free". */
export function tierName(name: string): string {
  return name.split(/\s*[—–(:]\s*/)[0].trim();
}
