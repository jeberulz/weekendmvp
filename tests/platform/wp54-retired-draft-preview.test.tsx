import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import PreviewPage from "../../app/preview/[token]/page";
import { SITE_INPUT_CONTRACT_VERSION } from "../../convex/platform/engine/contracts";
import type { PreviewView } from "../../convex/platform/preview/read";
import { SITE_RENDER_SPEC_CONTRACT_VERSION, serializeSiteRenderSpec } from "../../convex/platform/preview/renderSpec";

/**
 * WP54-S5, review round 3. A preview minted for an engine draft before the
 * backend deploy stays viewable for up to 7 days, but the claim now refuses
 * it. The page must say so instead of offering "Keep this site" (a dead end),
 * and must not link to the withheld idea page. Ordinary previews keep the
 * claim bar unchanged. The page is rendered whole from what the read path
 * returns.
 */

const read = vi.hoisted(() => ({ view: null as PreviewView | null }));
vi.mock("convex/nextjs", () => ({ fetchAction: async () => read.view }));

/** A well-formed capability token: 64 lowercase hex characters. */
const TOKEN = "0123456789abcdef".repeat(4);
const HEADLINE = "Review every pull request calmly";

function view(researchWithheld: boolean): PreviewView {
  return {
    renderSpec: serializeSiteRenderSpec({
      contractVersion: SITE_RENDER_SPEC_CONTRACT_VERSION,
      templateId: "editorial",
      siteInput: {
        contractVersion: SITE_INPUT_CONTRACT_VERSION,
        headline: HEADLINE,
        subheadline: "Repository-aware review for small teams.",
        problemStatement: "Small teams merge risky diffs because review queues pile up.",
        keyBenefits: ["Flags the risky lines first"],
        socialProof: [],
        callToAction: { label: "Get early access" },
      },
    }),
    expiresAt: Date.now() + 60_000,
    claimed: false,
    researchWithheld,
  };
}

async function renderPreview(current: PreviewView) {
  read.view = current;
  return renderToStaticMarkup(await PreviewPage({ params: Promise.resolve({ token: TOKEN }) }));
}

describe("the preview page", () => {
  test("a retired draft's preview says it can't be kept, with no claim and no idea link", async () => {
    const html = await renderPreview(view(true));
    // The preview itself still renders until it expires.
    expect(html).toContain(HEADLINE);
    expect(html).toContain("Research retired");
    expect(html).toContain("so its preview can’t be kept as a site");
    expect(html).not.toContain("Keep this site");
    expect(html).not.toContain("claimPreview");
    expect(html).not.toMatch(/href="\/ideas\//);
  });

  test("an ordinary preview keeps the claim bar", async () => {
    const html = await renderPreview(view(false));
    expect(html).toContain(HEADLINE);
    expect(html).toMatch(new RegExp(`<a [^>]*href="/signup\\?claimPreview=${TOKEN}"[^>]*>Keep this site</a>`));
    expect(html).not.toContain("Research retired");
  });
});
