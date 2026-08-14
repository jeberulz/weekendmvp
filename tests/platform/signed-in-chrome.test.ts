import { describe, expect, test } from "vitest";
import {
  COLD_OBJECT_LABEL,
  KILLED_DESTINATIONS,
  SIGNED_IN_HREF,
  canonicalSignedInReturn,
  chromeHere,
  shouldStripLibraryView,
} from "../../lib/signed-in-chrome";

describe("signed-in chrome model", () => {
  test("home and library are the only here-states", () => {
    expect(chromeHere("/dashboard")).toBe("home");
    expect(chromeHere("/dashboard/explore")).toBe("library");
    expect(chromeHere("/dashboard/explore/extra")).toBe("library");
  });

  test("killed destinations are not chrome hrefs", () => {
    const hrefs = Object.values(SIGNED_IN_HREF);
    for (const killed of KILLED_DESTINATIONS) {
      expect(hrefs).not.toContain(killed);
    }
    expect(hrefs).not.toContain("/dashboard/explore?view=saved");
    expect(hrefs).not.toContain("/dashboard/explore?view=interested");
  });

  test("saved and interested views strip to the library picker", () => {
    expect(shouldStripLibraryView("saved")).toBe(true);
    expect(shouldStripLibraryView("interested")).toBe(true);
    expect(shouldStripLibraryView("for_you")).toBe(false);
    expect(shouldStripLibraryView(undefined)).toBe(false);
  });

  test("cold chrome names the object as a choice, not a greeting", () => {
    expect(COLD_OBJECT_LABEL).toBe("Choose an idea");
    expect(COLD_OBJECT_LABEL.toLowerCase()).not.toContain("welcome");
  });

  test("killed paths collapse to home or the tabless library", () => {
    expect(canonicalSignedInReturn("/dashboard/billing")).toBe(
      SIGNED_IN_HREF.home,
    );
    expect(canonicalSignedInReturn("/dashboard/new")).toBe(SIGNED_IN_HREF.home);
    expect(
      canonicalSignedInReturn("/dashboard/projects/abc"),
    ).toBe("/dashboard?project=abc");
    expect(
      canonicalSignedInReturn("/dashboard/explore", "?view=saved"),
    ).toBe(SIGNED_IN_HREF.library);
    expect(
      canonicalSignedInReturn("/dashboard/explore", "?q=cart"),
    ).toBe("/dashboard/explore?q=cart");
  });
});
