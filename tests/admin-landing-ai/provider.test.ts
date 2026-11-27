import { afterEach, expect, test, vi } from "vitest";
import { configuredLandingModel } from "@/lib/landing-ai/provider";

const sdk = vi.hoisted(() => ({ create: vi.fn(), constructed: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: sdk.create };
    constructor(options: unknown) { sdk.constructed(options); }
  },
}));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

test("an empty key avoids even constructing the provider", () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  expect(configuredLandingModel()).toBeNull();
  expect(sdk.constructed).not.toHaveBeenCalled();
});

test("the provider receives only structured editorial context and reports actual usage", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "unit-test-placeholder");
  sdk.create.mockResolvedValue({
    stop_reason: "tool_use",
    content: [{ type: "tool_use", name: "return_editorial_proposal", input: { "hero.title": "Weekend ideas" } }],
    usage: { input_tokens: 55, output_tokens: 14 },
  });
  const result = await configuredLandingModel()!({
    system: "House voice", action: "shorten", instruction: "", before: { "hero.title": "Ideas for the weekend" },
    fields: [{ id: "hero.title", label: "Heading" }], outputSchema: { type: "object", additionalProperties: false },
  });
  expect(result).toEqual({ output: { "hero.title": "Weekend ideas" }, usage: { inputTokens: 55, outputTokens: 14 } });
  const [input] = sdk.create.mock.calls[0];
  expect(input).toMatchObject({ model: "claude-haiku-5-5", max_tokens: 4096, system: "House voice" });
  expect(JSON.parse(input.messages[0].content)).toEqual({
    action: "shorten", instruction: "", before: { "hero.title": "Ideas for the weekend" },
    fields: [{ id: "hero.title", label: "Heading" }],
  });
});
