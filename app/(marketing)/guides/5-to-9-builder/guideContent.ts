export const GUIDE_PATH = "/guides/5-to-9-builder";
export const GUIDE_TITLE = "The 5-to-9 Builder";
export const BUILD_ALONG_PRICE = "$47";
export const GUIDE_HEADLINE = "AI made building free. Knowing what to build is the job now.";
export const GUIDE_DESCRIPTION =
  "AI made building free. Knowing what to build is the job now. A free guide for 9-to-5ers: find an idea worth your evenings and prove someone will pay for it before you build it.";

export const SECTIONS = [
  { id: "s01", title: "The Shift", summary: "Building is free now; validation is the scarce skill." },
  { id: "s02", title: "The Method", summary: "The 5 steps: Find it, Who pays?, Pick it, Prove it, Sell it." },
  { id: "s03", title: "The 6 Skills", summary: "Each ends with a “You're ready when…” test." },
  { id: "s04", title: "The Catch", summary: "Most ideas won't work. Time is the real constraint." },
  { id: "s05", title: "Where You're Starting From", summary: "Designer, developer, ops & marketing, non-technical." },
  { id: "s06", title: "The 30-Day Plan", summary: "Four weeks, each ending with a shipped proof." },
  { id: "s07", title: "The Idea Bank", summary: (count: number) => `How to use ${count} researched ideas, with one worked validation.` },
  { id: "s08", title: "The First Sale", summary: "The offer, the price, the ask. Scripts included." },
  { id: "s09", title: "Self-Check", summary: "A 15–20 item checklist that saves on your device." },
  { id: "s10", title: "The Prompt", summary: "A “validate my idea” prompt for Claude or Grok." },
  { id: "s11", title: "FAQ", summary: "Five common questions." },
] as const;

export const GUIDE_BOOTSTRAP = `(function () {
  var mode = "locked";
  try {
    if (localStorage.getItem("weekendmvp_subscribed") === "true") mode = "returning";
  } catch {}
  document.currentScript.parentElement.setAttribute("data-guide", mode);
})();`;
