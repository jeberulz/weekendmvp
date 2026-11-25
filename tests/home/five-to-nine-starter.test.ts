import { describe, expect, test, vi } from "vitest";

// next/image reads `document` at import time, which the edge-runtime test
// environment does not provide. Stub it: the page only needs the <img>.
vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: (props: Record<string, unknown>) =>
      React.createElement("img", props),
  };
});

import manifestJson from "../../ideas/manifest.json";
import { metadata } from "../../app/(marketing)/5-to-9-starter/page";
import { GUIDE_AUTOMATION_ID } from "../../lib/beehiiv-client";
import { liveIdeas } from "../../lib/home/library";
import type { ManifestIdea } from "../../lib/home/types";

describe("5-to-9 Starter landing page", () => {
  test("wires the form to the 5-to-9 Starter guide automation", () => {
    expect(GUIDE_AUTOMATION_ID).toBe(
      "aut_ccd70ec4-dff3-4a10-8d26-290cb7fa9bc2",
    );
  });

  test("has its own canonical route and title, not the Starter Kit's", () => {
    expect(metadata.alternates?.canonical).toBe("/5-to-9-starter");
    expect(metadata.title).toEqual({
      absolute: expect.stringContaining("5-to-9 Starter"),
    });
  });

  test("shows the live idea count, not the raw manifest rows", () => {
    const rows = (manifestJson as { ideas: ManifestIdea[] }).ideas;
    const live = liveIdeas(rows);
    // Two retired rows sit in the manifest; the page must not count them.
    expect(rows.length).toBe(231);
    expect(live.length).toBe(229);
  });
});
