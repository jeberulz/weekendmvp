import { describe, expect, test } from "vitest";
import { needsYouCount, needsYouTail, openReviews } from "@/lib/workspace/needsYou";

describe("one definition of need you", () => {
  const rows = [{ expiresAt: 5 }, { expiresAt: 50 }, { expiresAt: 60 }];

  test("open reviews drop expired cards", () => {
    expect(openReviews(rows, 10)).toEqual([{ expiresAt: 50 }, { expiresAt: 60 }]);
    expect(openReviews(rows, 50)).toEqual([{ expiresAt: 60 }]);
  });

  test("the count is the number of open reviews", () => {
    expect(needsYouCount(rows, 10)).toBe(2);
    expect(needsYouCount(rows, 100)).toBe(0);
    expect(needsYouCount([], 10)).toBe(0);
  });

  test("the heading tail words each count", () => {
    expect(needsYouTail(0)).toBe("Nobody needs you right now.");
    expect(needsYouTail(1)).toBe("1 needs you.");
    expect(needsYouTail(3)).toBe("3 need you.");
  });
});
