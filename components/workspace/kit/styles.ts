/** Shared class strings. Tokens are the `home-*` theme colours in app/globals.css. */

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

/**
 * Pending / disabled look for buttons that stay focusable (`aria-disabled`):
 * sunk fill, dashed border, ink-2 text (about 8:1 on the fill), no hover change.
 */
const PENDING =
  "aria-disabled:cursor-not-allowed aria-disabled:border aria-disabled:border-dashed aria-disabled:border-home-ink-3 aria-disabled:bg-home-sunk aria-disabled:text-home-ink-2 aria-disabled:hover:bg-home-sunk";
const DISABLED =
  "disabled:cursor-not-allowed disabled:bg-home-sunk disabled:text-home-ink-2";

const BTN_BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors motion-reduce:transition-none";

export const BTN_PRIMARY = `${BTN_BASE} ${FOCUS} ${DISABLED} ${PENDING} bg-home-ink text-home-card hover:bg-home-panel`;
export const BTN_SECONDARY = `${BTN_BASE} ${FOCUS} ${DISABLED} ${PENDING} border border-home-rule bg-home-card text-home-ink hover:bg-home-sunk`;
export const BTN_APPROVED = `${BTN_BASE} ${FOCUS} ${DISABLED} ${PENDING} border border-home-sage-ink bg-home-sage text-home-sage-ink`;
export const BTN_CHANGES = `${BTN_BASE} ${FOCUS} ${DISABLED} ${PENDING} border border-home-sky-ink bg-home-sky text-home-sky-ink`;

export const ICON_BTN = `inline-flex size-10 items-center justify-center rounded-full border border-home-rule bg-home-card text-home-ink hover:bg-home-sunk ${FOCUS} ${DISABLED} ${PENDING}`;

export const EYEBROW =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-home-ink-3";

/** Pill shell shared by StatusPill and chips (System PILL_BASE). */
export const PILL_BASE = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium";

/** Neutral chip and the ember "Suggested" chip from System. */
export const CHIP = `${PILL_BASE} border border-home-rule bg-home-card text-home-ink-2`;
export const CHIP_SUGGESTED = `${PILL_BASE} border border-home-orange-ink/30 bg-home-ember-soft text-home-orange-ink`;

/** Plain mono "Coming soon" tag: bare text, no pill (System and Nav boards). */
export const COMING_SOON_TAG = "font-mono text-[11px] text-home-ink-3";

/** Eyebrow in ember (page headers). home-orange-ink is 5.2:1 on paper. */
export const EYEBROW_EMBER =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-ink";

/** Chat and approval card shell: card fill, rounded-lg. */
export const CARD_SHELL = "flex flex-col gap-2 rounded-lg border border-home-rule bg-home-card p-3";

export const CARD = "rounded-xl border border-home-rule bg-home-card";
export const SR_ONLY = "sr-only";
