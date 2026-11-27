/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";

// vi.mock factories are hoisted above top-level consts, so the stubs live
// inside the factories (same pattern as five-to-nine-starter.test.ts).
const searchState = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => searchState.params,
}));
vi.mock("@/lib/fonts", () => ({
  newsreaderEditorial: { variable: "newsreader-test" },
}));
vi.mock("@/components/forms/BeehiivSubscribeForm", async () => {
  const React = await import("react");
  return {
    // .test.ts files cannot use JSX in this repo, so the stub is createElement.
    BeehiivSubscribeForm: (props: {
      automationId?: string;
      utmCampaign?: string;
      successHref?: string | null;
      submitLabel?: string;
      emailPlaceholder?: string;
      inputClassName?: string;
      buttonClassName?: string;
    }) =>
      React.createElement(
        "form",
        {
          action: props.successHref ?? "",
          "data-automation-id": props.automationId ?? "",
        },
        React.createElement(
          "label",
          { htmlFor: "proof-email" },
          "Email address",
        ),
        React.createElement("input", {
          id: "proof-email",
          name: "email",
          type: "email",
          placeholder: props.emailPlaceholder,
          className: props.inputClassName,
        }),
        React.createElement(
          "button",
          { type: "submit", className: props.buttonClassName },
          props.submitLabel,
        ),
      ),
  };
});

import ProofOfWorkPage, {
  metadata,
} from "../../app/(marketing)/proof-of-work/page";
import { ProofSubscribedModal } from "../../app/(marketing)/proof-of-work/ProofSubscribedModal";
import {
  PROOF_OF_WORK_AUTOMATION_ID,
  subscribeViaApi,
} from "../../lib/beehiiv-client";

afterEach(() => {
  searchState.params = new URLSearchParams();
  vi.unstubAllGlobals();
});

describe("Proof of Work landing page", () => {
  const html = renderToStaticMarkup(createElement(ProofOfWorkPage));

  it("renders the promise as the hero headline", () => {
    // The headline wraps "a year of proof" in <em>, so assert the fragments.
    expect(html).toContain("Walk into your review with");
    expect(html).toContain("a year of proof");
    expect(html).toContain("already written.");
    expect(html).toContain("Free · No account · Yours to keep");
  });

  it("mounts the Newsreader editorial font variable on the page", () => {
    expect(html).toContain("newsreader-test");
  });

  it("renders a real video hero with the placeholder clip and a sound toggle", () => {
    expect(html).toContain("<video");
    expect(html).toContain('src="/hero-video.mp4"');
    expect(html).toContain("muted");
    expect(html).toContain("loop");
    // React renders these DOM properties camel-cased in static markup.
    expect(html).toContain("autoPlay");
    expect(html).toContain("playsInline");
    expect(html).toContain("Unmute hero video");
    expect(html).not.toContain("TODO-HERO-VIDEO");
  });

  it("renders the begun gateway band with the three parts", () => {
    expect(html).toContain("Log it.");
    expect(html).toContain("Get it seen.");
    expect(html).toContain("Bring the proof.");
    expect(html).toContain('href="#inside-log"');
    expect(html).toContain('href="#inside-visibility"');
    expect(html).toContain('href="#inside-review"');
  });

  it("renders the five honest framework numbers", () => {
    expect(html).toContain("parts to the framework");
    expect(html).toContain("visibility tactics");
    expect(html).toContain("review prompts");
    expect(html).toContain("seconds to log a win");
    expect(html).toContain("minutes, once a week");
  });

  it("renders all eight visibility tactics", () => {
    for (const name of [
      "Don&#x27;t assume your work speaks for itself",
      "Send a weekly wins email to your manager",
      "Back every win with a number",
      "Keep your elevator pitch ready",
      "Build relationships outside your team",
      "Get more from your mentors",
      "Choose mentors by influence",
      "Ask what it takes to get promoted",
    ]) {
      expect(html).toContain(name);
    }
  });

  it("renders the three parts and the FAQ", () => {
    expect(html).toContain("Your memory is not a filing system.");
    expect(html).toContain("Good work doesn&#x27;t speak for itself.");
    expect(html).toContain("Your review is a story, told with evidence.");
    for (const question of [
      "Is it really free?",
      "Where does my data go?",
      "Do I need an account?",
      "What do I get?",
      "What happens after I sign up?",
    ]) {
      expect(html).toContain(question);
    }
  });

  it("renders two email capture forms wired to the subscribed modal", () => {
    const forms = html.match(/<form/g) ?? [];
    expect(forms).toHaveLength(2);
    const submits = html.match(/Send me Proof of Work/g) ?? [];
    expect(submits).toHaveLength(2);
    const actions = html.match(/action="\/proof-of-work\?subscribed=true"/g) ?? [];
    expect(actions).toHaveLength(2);
  });

  it("passes the Proof of Work automation id to both forms", () => {
    const ids = html.match(/data-automation-id="([^"]*)"/g) ?? [];
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(id).toBe(
        'data-automation-id="aut_de485adc-9924-4b55-a1b3-fa1b8599d6c0"',
      );
    }
  });

  it("subscribes through the Proof of Work automation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      subscribeViaApi({
        email: "test@example.com",
        automationIds: [PROOF_OF_WORK_AUTOMATION_ID],
        utmCampaign: "proof-of-work",
        utmSource: "proof-of-work",
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/subscribe",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          automation_ids: ["aut_de485adc-9924-4b55-a1b3-fa1b8599d6c0"],
          utm_campaign: "proof-of-work",
          utm_source: "proof-of-work",
        }),
      }),
    );
  });

  it("shows the download link and the real email subject after subscribing", async () => {
    searchState.params = new URLSearchParams("subscribed=true");
    render(createElement(ProofSubscribedModal));
    const dialog = await screen.findByRole("dialog", undefined, {
      timeout: 2000,
    });
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Your Proof of Work file is ready")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Open Proof of Work" });
    expect(link.getAttribute("href")).toBe(
      "https://proof-of-work-john-iseghohis-projects.vercel.app",
    );
  });

  it("closes with the proof statement", () => {
    // The closing heading wraps "already written." in <em>.
    expect(html).toContain("A year of proof,");
    expect(html).toContain("already written.");
  });

  it("uses no text symbols as icons and no reel/creator material", () => {
    for (const banned of ["→", "✓", "↗", "•", "&nearr;"]) {
      expect(html).not.toContain(banned);
    }
    for (const banned of [
      "Instagram",
      "reel",
      "Christian",
      "Sylvia",
      "Simon",
      "3% market share",
      "Work Dashboard",
      "TODO",
    ]) {
      expect(html).not.toContain(banned);
    }
  });

  it("gives the capture and closing sections the page's standard section spacing", () => {
    // Both bands previously used the `tight` override (padding-top: 0), so
    // the capture eyebrow sat flush against the gateway above while the
    // band's bottom padding stacked against the next section's top padding.
    // They now use the standard section padding like every other section.
    const capture = html.match(/<section[^>]*\bid="get"[^>]*>/);
    expect(capture).not.toBeNull();
    expect(capture![0]).not.toContain("tight");
    const closing = html.match(
      /<section[^>]*aria-labelledby="proof-closing-title"[^>]*>/,
    );
    expect(closing).not.toBeNull();
    expect(closing![0]).not.toContain("tight");
  });

  it("has the right metadata", () => {
    expect(metadata.title).toEqual({
      absolute:
        "Proof of Work: walk into your review with a year of proof already written | Weekend MVP",
    });
    expect(metadata.alternates?.canonical).toBe("/proof-of-work");
    expect(metadata.description).toContain("free single file for 9-to-5ers");
  });
});
