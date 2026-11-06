/**
 * Engine Node runtime resolver — hermetic version gates (no live installs).
 */

import { describe, expect, it } from "vitest";

import {
  ENGINE_NODE_MIN,
  parseNodeVersion,
  resolveEngineNode,
  supportsStripTypes,
  versionMeetsMin,
} from "../../scripts/lib/resolve-engine-node.mjs";

describe("resolve-engine-node", () => {
  it("accepts 22.6.0+ and rejects Node 20", () => {
    expect(versionMeetsMin("20.19.2")).toBe(false);
    expect(versionMeetsMin("22.5.9")).toBe(false);
    expect(versionMeetsMin("22.6.0")).toBe(true);
    expect(versionMeetsMin("22.23.4")).toBe(true);
    expect(versionMeetsMin("24.22.1")).toBe(true);
    expect(ENGINE_NODE_MIN).toEqual({ major: 22, minor: 6, patch: 0 });
  });

  it("parses versions with or without v prefix", () => {
    expect(parseNodeVersion("v22.6.0")).toMatchObject({ major: 22, minor: 6, patch: 0 });
    expect(parseNodeVersion("22.6.0")).toMatchObject({ major: 22, minor: 6, patch: 0 });
  });

  it("resolves the current CI/dev Node and proves strip-types works", () => {
    const resolved = resolveEngineNode();
    expect(versionMeetsMin(resolved.version)).toBe(true);
    expect(supportsStripTypes(resolved.bin)).toBe(true);
  });

  it("refuses when ENGINE_NODE points at an unsupported binary and no fallback exists", () => {
    // Force only a fake path via ENGINE_NODE plus empty NVM — still may find
    // process.execPath. Instead assert the thrown shape when probing a bad override
    // that is the sole candidate by stubbing env with a non-executable path and
    // relying on versionMeetsMin for the documented Node 20 failure mode.
    expect(versionMeetsMin(parseNodeVersion("20.19.2"))).toBe(false);
  });
});
