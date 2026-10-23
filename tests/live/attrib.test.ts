import { describe, expect, test } from "vitest";
import {
  appendLiveAttribToUrl,
  hasLiveAttrib,
  readLiveAttribFromSearch,
} from "@/lib/live/attrib";

describe("live attrib", () => {
  test("reads utm_* and src/placement aliases", () => {
    const a = readLiveAttribFromSearch(
      "?src=bw-claude&placement=hero&utm_medium=site",
      { campaign: "live-w1" },
    );
    expect(a).toEqual({
      utm_source: "bw-claude",
      utm_medium: "site",
      utm_campaign: "live-w1",
      utm_content: "hero",
    });
    expect(hasLiveAttrib(a)).toBe(true);
  });

  test("prefers explicit utm_* over aliases", () => {
    const a = readLiveAttribFromSearch(
      "?src=ignored&utm_source=li-webinar-1031&placement=x&utm_content=hero",
      { campaign: "live-w1" },
    );
    expect(a.utm_source).toBe("li-webinar-1031");
    expect(a.utm_content).toBe("hero");
  });

  test("appends UTMs onto a bare Luma URL without clobbering existing", () => {
    const href = appendLiveAttribToUrl("https://luma.com/wzlj5h23", {
      utm_source: "bw-claude",
      utm_campaign: "live-w1",
      utm_content: "hero",
      utm_medium: "site",
    });
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe("https://luma.com/wzlj5h23");
    expect(url.searchParams.get("utm_source")).toBe("bw-claude");
    expect(url.searchParams.get("utm_campaign")).toBe("live-w1");
    expect(url.searchParams.get("utm_content")).toBe("hero");
    expect(url.searchParams.get("utm_medium")).toBe("site");
  });

  test("does not overwrite UTMs already on the Luma URL", () => {
    const href = appendLiveAttribToUrl(
      "https://luma.com/wzlj5h23?utm_source=keep-me",
      { utm_source: "bw-claude", utm_campaign: "live-w1" },
    );
    expect(new URL(href).searchParams.get("utm_source")).toBe("keep-me");
    expect(new URL(href).searchParams.get("utm_campaign")).toBe("live-w1");
  });
});
