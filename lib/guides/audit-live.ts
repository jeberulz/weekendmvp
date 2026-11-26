import { PLACEHOLDER_RE, STAND_IN_ALT_RE, currencySymbols, type Finding, type FindingSeverity } from "./audit.ts";
import type { GuideSpec } from "./spec-schema.ts";

/**
 * Live audit evaluation (WP103-S2). The browser driver in `scripts/audit-guide.mjs` collects a
 * `LiveSnapshot`. This file judges it, so the rules can be tested with fixtures and no browser.
 */

export type PageState = {
  /** Value of the wrapper's `data-guide` attribute: locked, pending, confirmed or returning. */
  mode: string | null;
  /** Ids of guide sections that are visible, in page order. */
  visibleSections: string[];
  /** Visible page text. */
  text: string;
  /** Alt text of every image. */
  imageAlts: string[];
};

export type LiveSnapshot = {
  url: string;
  /** Uncaught page errors seen while loading and unlocking. */
  pageErrors: string[];
  /** A fresh visitor. */
  locked: PageState;
  /** After unlocking, by submit or by the stored flag. */
  unlocked: PageState;
  /** After a reload of the unlocked page. */
  returning: PageState;
  /** True when the page scrolls sideways at 390px wide. */
  mobileSidewaysScroll: boolean;
  /** `null` when no submit was attempted. */
  subscribe: { status: number | null } | null;
};

export function evaluateLive(spec: GuideSpec, snap: LiveSnapshot): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: string, severity: FindingSeverity, message: string) => findings.push({ rule, severity, message });
  const allIds = spec.sections.map((section) => section.id);
  const gated = spec.gate.mode !== "none";

  for (const error of snap.pageErrors) add("live-page-error", "error", `page error: ${error.slice(0, 160)}`);
  if (snap.mobileSidewaysScroll) add("live-sideways-scroll", "error", "the page scrolls sideways at 390px wide");

  const visibleText = [snap.locked.text, snap.unlocked.text, snap.returning.text];
  const alts = [...snap.locked.imageAlts, ...snap.unlocked.imageAlts];
  if (visibleText.some((text) => PLACEHOLDER_RE.test(text))) {
    add("live-placeholder-text", "error", "placeholder wording is visible on the page");
  }
  for (const alt of alts) {
    if (STAND_IN_ALT_RE.test(alt)) add("live-placeholder-alt", "error", `image alt describes a stand-in: "${alt}"`);
  }
  const symbols = currencySymbols([snap.unlocked.text]);
  if (symbols.size > 1) {
    const list = [...symbols].map(([symbol, count]) => `${symbol} x${count}`).join(", ");
    add("live-currency-mixed", "error", `the page mixes currencies: ${list}`);
  }

  if (!gated) {
    add("live-gate-skipped", "info", "gate.mode is none, so the locked, unlock and reload checks were skipped");
    return findings;
  }

  const first = allIds[0];
  const lockedSections = snap.locked.visibleSections;
  if (lockedSections.length !== 1 || lockedSections[0] !== first) {
    add("live-locked-state", "error", `a fresh visitor should see only ${first}, saw: ${lockedSections.join(", ") || "nothing"}`);
  }
  if (snap.locked.mode !== "locked") add("live-locked-mode", "error", `a fresh visitor's wrapper mode should be "locked", was "${snap.locked.mode}"`);

  const missing = allIds.filter((id) => !snap.unlocked.visibleSections.includes(id));
  if (missing.length) add("live-unlocked-state", "error", `after unlocking, these sections are still hidden: ${missing.join(", ")}`);

  const missingAfterReload = allIds.filter((id) => !snap.returning.visibleSections.includes(id));
  if (snap.returning.mode !== "returning") {
    add("live-returning-mode", "error", `after a reload the wrapper mode should be "returning", was "${snap.returning.mode}"`);
  }
  if (missingAfterReload.length) add("live-returning-state", "error", `after a reload, these sections are hidden: ${missingAfterReload.join(", ")}`);

  if (snap.subscribe === null) {
    add("live-subscribe-skipped", "info", "no email was passed, so no subscription was submitted and the subscribe check was skipped");
  } else if (snap.subscribe.status !== 200) {
    add("live-subscribe", "error", `/api/subscribe returned ${snap.subscribe.status ?? "no response"}, expected 200`);
  }

  return findings;
}
