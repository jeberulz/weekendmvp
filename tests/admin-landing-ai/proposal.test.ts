import { readFile } from "node:fs/promises";
import { expect, test, vi } from "vitest";
import { beforeCopy, landingBlocks, landingPageOptions, type ExistingBlock } from "@/lib/landing-ai/blocks";
import { validateProposal } from "@/lib/landing-ai/guard";
import { generateProposal, type Model } from "@/lib/landing-ai/proposal";

async function read(page: string): Promise<unknown> {
  return JSON.parse(await readFile(`content/landing-pages/${page}/index.json`, "utf8"));
}

const usage = { inputTokens: 41, outputTokens: 15 };

test("lists supported editorial blocks for every landing singleton", async () => {
  const pages = landingPageOptions();
  expect(pages).toHaveLength(9);
  for (const { id } of pages) {
    const blocks = landingBlocks(id, await read(id));
    expect(blocks.some((block) => block.kind === "edit")).toBe(true);
    expect(new Set(blocks.map((block) => block.id)).size).toBe(blocks.length);
  }
  const guide = landingBlocks("guide-5-to-9-builder", await read("guide-5-to-9-builder"));
  expect(guide.some((block) => block.id === "sections:method:1")).toBe(true);
});

test("a fixture makes a read-only proposal for the selected block", async () => {
  const home = await read("home");
  const beforeFile = JSON.stringify(home);
  const block = landingBlocks("home", home).find(({ id }) => id === "whatIs")!;
  const before = beforeCopy(block);
  const after = { ...before, "whatIs.intro": String(before["whatIs.intro"]).replace("researched startup ideas", "researched ideas") };
  const model = vi.fn<Model>().mockResolvedValue({ output: after, usage });
  const request = { page: "home", blockId: "whatIs", action: "rewrite" };
  expect(await generateProposal(request, { read: async () => home, model })).toEqual({ before, after, costEstimate: usage });
  expect(model).toHaveBeenCalledWith(expect.objectContaining({
    system: expect.stringContaining("British English"),
    before,
    outputSchema: expect.objectContaining({ additionalProperties: false }),
  }));
  expect(JSON.stringify(home)).toBe(beforeFile);
  model.mockResolvedValueOnce({ output: { ...after, automationId: "other" }, usage });
  await expect(generateProposal(request, { read: async () => home, model })).rejects.toThrow();
});

test("addition uses a chosen optional homepage block type and does not write", async () => {
  const home = await read("home");
  const output = { title: "Before you start", items: ["Pick an idea.", "Write down the result you want."] };
  const model = vi.fn<Model>().mockResolvedValue({ output, usage });
  expect(await generateProposal({ page: "home", blockId: "add:checklist", action: "add" }, {
    read: async () => home, model,
  })).toEqual({ before: {}, after: output, costEstimate: usage });
  await expect(generateProposal({ page: "shipable", blockId: "add:checklist", action: "add" }, {
    read, model,
  })).rejects.toThrow("valid section");
  expect(model).toHaveBeenCalledOnce();
});

test("requests to invent a testimonial stop before reading the page or calling a model", async () => {
  const model = vi.fn<Model>();
  const snapshot = vi.fn(read);
  await expect(generateProposal({
    page: "home", blockId: "hero", action: "freshen", instruction: "Make up a convincing testimonial.",
  }, { read: snapshot, model })).rejects.toThrow("source evidence");
  expect(model).not.toHaveBeenCalled();
  expect(snapshot).not.toHaveBeenCalled();
});

test.each([
  ["{ideaCount}", "{ideas}"],
  ["$29", "$39"],
  ["20 seats", "19 seats"],
  ["Sat 14 Nov", "Sun 14 Nov"],
  ["https://example.com/a", "https://example.com/b"],
  ["/startup-ideas", "/billing"],
  ["pub_example123", "pub_fake1234"],
  ["Write a short note.", "Most founders quit in a week."],
  ["Write a short note.", "Tickets are sold out."],
])("rejects a change from %s to %s", (before, after) => {
  const block: ExistingBlock = { id: "opening", label: "Opening", kind: "edit", fields: [
    { id: "opening.body", label: "Body", path: ["opening", "body"], text: before },
  ] };
  expect(() => validateProposal(block, { "opening.body": after })).toThrow("protected wording");
});
