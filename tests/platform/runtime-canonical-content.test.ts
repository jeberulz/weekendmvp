import { beforeEach, describe, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ read: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/mdx", () => ({ readMdxFile: state.read }));
vi.mock("convex/nextjs", () => ({ fetchQuery: state.query }));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
import { chooseIdeaBody } from "../../lib/canonical-idea-body";
import { getIdeaPackContent, getIdeaPrompts, getIdeaTiers } from "../../lib/dashboard/idea-prompts";

const body = "## The Problem\n\nA real problem.\n\n## Business Model\n\n- **Starter** — $29/mo\n\n## AI Prompts to Build This\n\n### Project Setup\n\n```text\nBuild the canonical feature.\n```\n";
beforeEach(() => { vi.clearAllMocks(); state.read.mockResolvedValue(null); state.query.mockResolvedValue(null); });

describe("canonical idea content shared by public research and dashboard", () => {
  test("local MDX wins over a database body, matching public page precedence", async () => {
    const file = { slug: "fixture", frontmatter: {}, content: body };
    state.read.mockResolvedValue(file);
    expect(chooseIdeaBody(file, { bodyMode: "convex", body: "stale" })?.content).toBe(body);
    expect(await getIdeaPrompts("fixture")).toEqual([{ title: "Project Setup", lines: ["Build the canonical feature."] }]);
    expect(state.query).not.toHaveBeenCalled();
  });

  test("a Convex-only idea supplies prompts, pricing and a useful pack", async () => {
    state.query.mockResolvedValue({ bodyMode: "convex", body });
    expect(await getIdeaPrompts("fixture")).toHaveLength(1);
    expect(await getIdeaTiers("fixture")).toEqual([{ name: "Starter", price: "$29/mo" }]);
    expect(await getIdeaPackContent("fixture")).toMatchObject({ problem: "A real problem.", prompts: [{ title: "Project Setup", lines: ["Build the canonical feature."] }] });
  });

  test("a body not approved for Convex rendering does not become an export", async () => {
    state.query.mockResolvedValue({ bodyMode: "mdx", body });
    expect(await getIdeaPackContent("fixture")).toBeNull();
    expect(await getIdeaPrompts("fixture")).toBeNull();
  });

  test("unknown compare slugs tolerate backend outage without weakening exports", async () => {
    state.query.mockRejectedValue(new Error("offline"));
    expect(await getIdeaTiers("made-up-slug")).toEqual([]);
    await expect(getIdeaPackContent("made-up-slug")).rejects.toThrow("offline");
    await expect(getIdeaPrompts("made-up-slug")).rejects.toThrow("offline");
  });
});
