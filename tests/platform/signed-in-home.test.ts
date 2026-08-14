/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import {
  COLD_OBJECT_LABEL,
  objectHomeHref,
  canonicalSignedInReturn,
} from "../../lib/signed-in-chrome";
import {
  chromeObjectLabel,
  PUBLISH_PACK_ID,
  publishPriceLabel,
} from "../../lib/signed-in-home";

describe("signed-in home model", () => {
  test("chrome names cold, unpublished, and live objects", () => {
    expect(chromeObjectLabel({ kind: "cold" })).toBe(COLD_OBJECT_LABEL);
    expect(chromeObjectLabel({ kind: "day1", title: "Cart recovery" })).toBe(
      "Cart recovery",
    );
    expect(
      chromeObjectLabel({
        kind: "dayn",
        title: "Cart recovery",
        hostname: "cart.weekendmvp.app",
      }),
    ).toBe("cart.weekendmvp.app");
  });

  test("object home preserves the switched project", () => {
    expect(objectHomeHref(undefined)).toBe("/dashboard");
    expect(objectHomeHref("abc")).toBe("/dashboard?project=abc");
  });

  test("publish is one catalog price, not a pack shop", () => {
    expect(PUBLISH_PACK_ID).toBe("starter");
    expect(publishPriceLabel()).toBe("$29");
  });
});

describe("signed-in chrome returns", () => {
  test("a project cockpit URL becomes that object's home", () => {
    expect(canonicalSignedInReturn("/dashboard/projects/abc")).toBe(
      "/dashboard?project=abc",
    );
  });
});
