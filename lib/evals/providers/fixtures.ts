/**
 * WP41-S2. Fixture transport for the OpenRouter adapter.
 *
 * A `fetch`-shaped function, so the adapter, budget, and ledger under test
 * are the real ones. Only the transport is substituted: no key, no network,
 * no spend. Payload shapes follow OpenRouter's documented chat-completions
 * and model-list responses.
 */

import type { Fetcher } from "./openrouter.ts";

/** Stand-in judge IDs for fixture runs before real models are pinned. */
export const FIXTURE_MODELS = ["fixture/judge-a", "fixture/judge-b", "fixture/judge-c"];

/** $0.50 / $1.50 per 1M tokens, as OpenRouter's per-token price strings. */
export const FIXTURE_PRICING = { prompt: "0.0000005", completion: "0.0000015", request: "0" };

export type FixtureChatBody = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens: number;
  temperature?: number;
  response_format?: { type: string };
};

export type FixtureReply = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Reported `usage.cost`. Omit to derive from FIXTURE_PRICING; null to leave it out. */
  costUsd?: number | null;
  finishReason?: string;
};

export type FixtureOptions = {
  /** Models the fixture catalog lists with FIXTURE_PRICING. */
  models?: string[];
  /** Build the reply for one chat call. Return a Response to fake an error. */
  reply?: (body: FixtureChatBody) => FixtureReply | Response;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const defaultReply = (): FixtureReply => ({ text: '{"ok":true}' });

export function createFixtureFetch(options: FixtureOptions = {}): Fetcher {
  const models = options.models ?? FIXTURE_MODELS;
  const reply = options.reply ?? defaultReply;

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.endsWith("/models")) {
      return json({
        data: models.map((id) => ({
          id,
          name: `Fixture ${id}`,
          context_length: 128_000,
          pricing: FIXTURE_PRICING,
        })),
      });
    }

    if (url.endsWith("/chat/completions")) {
      const body = JSON.parse(String(init?.body)) as FixtureChatBody;
      const out = reply(body);
      if (out instanceof Response) return out;

      const inputTokens =
        out.inputTokens ??
        body.messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
      const outputTokens = out.outputTokens ?? Math.ceil(out.text.length / 4);
      const cost =
        out.costUsd === undefined
          ? inputTokens * Number(FIXTURE_PRICING.prompt) +
            outputTokens * Number(FIXTURE_PRICING.completion)
          : out.costUsd;

      return json({
        id: "gen-fixture",
        model: body.model,
        choices: [
          {
            finish_reason: out.finishReason ?? "stop",
            message: { role: "assistant", content: out.text },
          },
        ],
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          ...(cost === null ? {} : { cost }),
        },
      });
    }

    throw new Error(`fixture fetch: unexpected URL ${url}`);
  }) as Fetcher;
}

/** Fails every request: proves a code path makes no network call. */
export function unreachableFetch(): Fetcher {
  return (async () => {
    throw new Error("ECONNREFUSED");
  }) as Fetcher;
}
