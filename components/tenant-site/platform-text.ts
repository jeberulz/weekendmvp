import { PROD_WWW_HOST } from "@/lib/canonical-path";

/**
 * Text and links the platform owns on every founder page. None of it is read from a landing spec or a brand kit,
 * so a model cannot reword the privacy line, the badge or the skip link. `tests/security/wp75-tenant-renderer.test.tsx`
 * renders hostile specs and checks these strings come out unchanged.
 */
export const PLATFORM_TEXT = Object.freeze({
  skipLink: "Skip to main content",
  navLabel: "Primary",
  promisesHeading: "Highlights",
  waitlistPrivacy: "We use your email only to send updates about this project, and you can unsubscribe from any email.",
  waitlistPrivacyLink: "How we handle your data",
  waitlistPrivacyHref: `https://${PROD_WWW_HOST}/privacy-policy`,
  badge: "Made with Weekend MVP",
  badgeHref: `https://${PROD_WWW_HOST}`,
  opensInNewTab: " (opens in new tab)",
  previewFormNote: "The sign-up form appears here once the site is published.",
});

/** The footer line: the year is the platform's (passed in by the route), the name is the founder's. */
export function copyrightLine(year: number, name: string): string {
  return `© ${Number.isInteger(year) ? year : ""} ${name}`.replace(/\s+/g, " ").trim();
}
