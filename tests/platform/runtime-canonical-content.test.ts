import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { api } from "../../convex/_generated/api";
const state = vi.hoisted(() => ({ read: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/mdx", () => ({ readMdxFile: state.read }));
vi.mock("convex/nextjs", () => ({ fetchQuery: state.query }));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
import { chooseIdeaBody } from "../../lib/canonical-idea-body";
import { getIdeaPackContent, getIdeaPrompts, getIdeaTiers } from "../../lib/dashboard/idea-prompts";

const body = "## The Problem\n\nA real problem.\n\n## Business Model\n\n- **Starter** — $29/mo\n\n## AI Prompts to Build This\n\n### Project Setup\n\n```text\nBuild the canonical feature.\n```\n";
beforeEach(() => {
  vi.clearAllMocks();
  state.read.mockResolvedValue(null);
  state.query.mockImplementation(async (ref) => getFunctionName(ref) === "editorial/public:bySlug" ? { state: "legacy" } : null);
});

describe("canonical idea content shared by public research and dashboard", () => {
  test("local MDX wins over a database body, matching public page precedence", async () => {
    const file = { slug: "fixture", frontmatter: {}, content: body };
    state.read.mockResolvedValue(file);
    expect(chooseIdeaBody(file, { bodyMode: "convex", body: "stale" })?.content).toBe(body);
    expect(await getIdeaPrompts("fixture", "test-token")).toEqual([{ title: "Project Setup", lines: ["Build the canonical feature."] }]);
    expect(state.query).toHaveBeenCalledWith(api.editorial.public.bySlug, { slug: "fixture" });
  });

  test("a Convex-only idea supplies prompts, pricing and a useful pack", async () => {
    state.query.mockImplementation(async (ref) => getFunctionName(ref) === "editorial/public:bySlug"
      ? { state: "legacy" }
      : { bodyMode: "convex", body });
    expect(await getIdeaPrompts("fixture", "test-token")).toHaveLength(1);
    expect(await getIdeaTiers("fixture", "test-token")).toEqual([{ name: "Starter", price: "$29/mo" }]);
    expect(await getIdeaPackContent("fixture", "test-token")).toMatchObject({ problem: "A real problem.", prompts: [{ title: "Project Setup", lines: ["Build the canonical feature."] }] });
  });

  test("a body not approved for Convex rendering does not become an export", async () => {
    state.query.mockImplementation(async (ref) => getFunctionName(ref) === "editorial/public:bySlug"
      ? { state: "legacy" }
      : { bodyMode: "mdx", body });
    expect(await getIdeaPackContent("fixture", "test-token")).toBeNull();
    expect(await getIdeaPrompts("fixture", "test-token")).toBeNull();
  });

  test("unknown compare slugs tolerate backend outage without weakening exports", async () => {
    state.query.mockRejectedValue(new Error("offline"));
    expect(await getIdeaTiers("made-up-slug", "test-token")).toEqual([]);
    await expect(getIdeaPackContent("made-up-slug", "test-token")).rejects.toThrow("offline");
    await expect(getIdeaPrompts("made-up-slug", "test-token")).rejects.toThrow("offline");
  });

  test("a removed idea never falls back to its checked-in MDX body", async () => {
    state.read.mockResolvedValue({ slug: "fixture", frontmatter: {}, content: body });
    state.query.mockResolvedValue({ state: "removed" });
    expect(await getIdeaPackContent("fixture", "test-token")).toBeNull();
    expect(state.read).not.toHaveBeenCalled();
  });
});
