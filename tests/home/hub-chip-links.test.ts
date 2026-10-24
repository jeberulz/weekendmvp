// @vitest-environment node
import { describe, expect, test } from "vitest";
import { audienceHubHref, toolHubHref } from "../../lib/hub-chip-links";

describe("hub chip links", () => {
  test("only links route-backed tool hubs", () => {
    expect(toolHubHref("cursor")).toBe("/build-with/cursor");
    expect(toolHubHref("claude-code")).toBe("/build-with/claude-code");
    expect(toolHubHref("not-a-tool")).toBeNull();
  });

  test("only links route-backed audience hubs", () => {
    expect(audienceHubHref("developers")).toBe("/ideas-for/developers");
    expect(audienceHubHref("pregnant-women")).toBeNull();
    expect(audienceHubHref("Senior care professionals")).toBeNull();
  });
});
