import { describe, expect, test } from "vitest";
import {
  avatarForExpression,
  eyeFollowOffset,
  expressionForEvent,
  scrollDirection,
  tiltForScroll,
} from "@/lib/idea-requests/character";

describe("widget character motion helpers", () => {
  test("scroll direction ignores tiny jitters", () => {
    expect(scrollDirection(100, 100)).toBe("none");
    expect(scrollDirection(100, 102)).toBe("none");
    expect(scrollDirection(100, 96)).toBe("up");
    expect(scrollDirection(100, 104)).toBe("down");
    expect(scrollDirection(100, 90)).toBe("up");
    expect(scrollDirection(100, 200)).toBe("down");
  });

  test("tilt leans up on scroll-up, down on scroll-down, upright when still", () => {
    expect(tiltForScroll("up", false)).toBe(-7);
    expect(tiltForScroll("down", false)).toBe(7);
    expect(tiltForScroll("none", false)).toBe(0);
    expect(tiltForScroll("down", true)).toBe(0);
    expect(tiltForScroll("up", true)).toBe(0);
  });

  test("eye-follow shifts toward the cursor and clamps to a few px", () => {
    const rect = { left: 0, top: 0, width: 100, height: 100 };
    expect(eyeFollowOffset(50, 50, rect, false)).toEqual({ x: 0, y: 0 });
    const right = eyeFollowOffset(100, 50, rect, false);
    expect(right.x).toBeGreaterThan(0);
    expect(right.x).toBeLessThanOrEqual(5);
    expect(right.y).toBe(0);
    // Far outside the circle still clamps.
    expect(eyeFollowOffset(1000, 1000, rect, false)).toEqual({ x: 5, y: 5 });
    expect(eyeFollowOffset(100, 50, rect, true)).toEqual({ x: 0, y: 0 });
    expect(eyeFollowOffset(100, 50, { left: 0, top: 0, width: 0, height: 0 }, false)).toEqual({
      x: 0,
      y: 0,
    });
  });

  test("expression follows interaction, and reduced motion stays idle", () => {
    expect(expressionForEvent("hover", false)).toBe("happy");
    expect(expressionForEvent("click", false)).toBe("celebrating");
    expect(expressionForEvent("vote-success", false)).toBe("celebrating");
    expect(expressionForEvent("submit-start", false)).toBe("thinking");
    expect(expressionForEvent("submit-success", false)).toBe("celebrating");
    expect(expressionForEvent("leave", false)).toBe("idle");
    expect(expressionForEvent("submit-error", false)).toBe("idle");
    expect(expressionForEvent("hover", true)).toBe("idle");
    expect(expressionForEvent("click", true)).toBe("idle");
  });

  test("avatar slots fall back to the idle image, never to an invented one", () => {
    const avatars = { idle: "/mascot-idle.png" };
    expect(avatarForExpression(avatars, "idle")).toBe("/mascot-idle.png");
    expect(avatarForExpression(avatars, "happy")).toBe("/mascot-idle.png");
    expect(avatarForExpression(avatars, "celebrating")).toBe("/mascot-idle.png");
    expect(
      avatarForExpression({ idle: "/mascot-idle.png", happy: "/mascot-happy.png" }, "happy"),
    ).toBe("/mascot-happy.png");
    expect(avatarForExpression({}, "idle")).toBeUndefined();
  });
});
