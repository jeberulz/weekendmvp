/** Shared class strings. Tokens are the `home-*` theme colours in app/globals.css. */

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

const BTN_BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors motion-reduce:transition-none disabled:cursor-not-allowed";

export const BTN_PRIMARY = `${BTN_BASE} ${FOCUS} bg-home-ink text-home-card hover:bg-home-panel disabled:bg-[#e6e0d4] disabled:text-home-ink-2`;
export const BTN_SECONDARY = `${BTN_BASE} ${FOCUS} border border-home-rule bg-home-card text-home-ink hover:bg-home-sunk disabled:bg-[#e6e0d4] disabled:text-home-ink-2`;
export const BTN_APPROVED = `${BTN_BASE} ${FOCUS} border border-home-sage-ink bg-home-sage text-home-sage-ink`;
export const BTN_CHANGES = `${BTN_BASE} ${FOCUS} border border-home-sky-ink bg-home-sky text-home-sky-ink`;

export const ICON_BTN = `inline-flex size-10 items-center justify-center rounded-full border border-home-rule bg-home-card text-home-ink hover:bg-home-sunk ${FOCUS} disabled:cursor-not-allowed disabled:text-home-ink-2`;

export const EYEBROW =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-home-ink-3";

export const CARD = "rounded-xl border border-home-rule bg-home-card";
export const SR_ONLY = "sr-only";
