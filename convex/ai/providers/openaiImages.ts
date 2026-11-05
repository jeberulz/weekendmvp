/**
 * WP71-S1. Image adapter for OpenAI Images (`gpt-image-2`), raw `fetch`.
 *
 * D11: photo-style offer and post images render here at `medium` quality.
 * No OpenAI SDK (it is not a dependency); the request is one POST, like the
 * engine's adapters.
 *
 * Only priced combinations are accepted (`pricing.ts`): `medium` at
 * 1536×1024 ($0.041) or 1024×1024 ($0.053), one image per call.
 *
 * Cost: gpt-image-2 is billed per token (text in, image out).
 * - Reservation (`openAiImageReservationMicroUsd`): the table price plus the
 *   prompt's UTF-8 bytes at the text-input rate (one token per byte, an upper bound).
 * - Settle: the larger of the table price and reported tokens × rates. Without
 *   usage it is the table price, `estimated: true`.
 *
 * Outcomes: 2xx with a PNG → `ImageResult` (bytes from `b64_json`, or a URL).
 * 2xx without one, or with bytes that are not a PNG → `invalid_output`,
 * billed `actual`, with the cost.
 * A 400 for a moderation block → `refusal`, billed `none`. Other statuses and
 * transport failures map as `transport.ts` describes.
 */

import {
  OPENAI_IMAGE_MODEL,
  OPENAI_IMAGE_PRICES_MICRO_USD,
  OPENAI_IMAGE_RATES_EFFECTIVE_FROM,
  openAiImageCostMicroUsd,
  openAiImageSettleMicroUsd,
  openAiImageTableMicroUsd,
  type OpenAiImageQuality,
  type OpenAiImageSize,
} from "../pricing";
import { fixtureOpenAiImagesFetch, type ImageFixtureResponder } from "./fixtures";
import { resolveProviderAccess, type ProviderEnv } from "./mode";
import {
  decodeBase64,
  isPng,
  isRecord,
  kindForHttpStatus,
  noReplyError,
  OPENAI_IMAGES_ENDPOINT,
  startDeadline,
  tokenCount,
  utf8Bytes,
} from "./transport";
import { FIXTURE_BILLED_AS_SUFFIX, ProviderError, type Fetcher, type ImageRequestBase, type ImageResult, type ProviderCost } from "./types";

export { OPENAI_IMAGES_ENDPOINT };

export type OpenAiImageRequest = ImageRequestBase & {
  readonly size: OpenAiImageSize;
  readonly quality: OpenAiImageQuality;
};

/** OpenAI error codes for a prompt its moderation blocked. */
const MODERATION_CODES = ["moderation_blocked", "content_policy_violation"];

function configError(message: string): ProviderError {
  return new ProviderError("openai_images", "config", message);
}

export function assertOpenAiImageRequest(request: OpenAiImageRequest): void {
  const prices: Record<string, Record<string, number> | undefined> = OPENAI_IMAGE_PRICES_MICRO_USD;
  const sizes = prices[request.quality];
  if (sizes === undefined) throw configError(`quality ${String(request.quality)} is not priced`);
  if (sizes[request.size] === undefined) throw configError(`size ${String(request.size)} is not priced`);
  if (request.prompt.trim().length === 0) throw configError("the image prompt is empty");
}

export function buildOpenAiImageBody(request: OpenAiImageRequest): Record<string, unknown> {
  assertOpenAiImageRequest(request);
  return {
    model: OPENAI_IMAGE_MODEL,
    prompt: request.prompt,
    size: request.size,
    quality: request.quality,
    n: 1,
    output_format: "png",
  };
}

/** The reservation for one call: table price plus the prompt bytes at the text-input rate. */
export function openAiImageReservationMicroUsd(request: OpenAiImageRequest): number {
  assertOpenAiImageRequest(request);
  return openAiImageCostMicroUsd({
    quality: request.quality,
    size: request.size,
    promptBytes: utf8Bytes(request.prompt),
  });
}

function imageCost(request: OpenAiImageRequest, usage: unknown, fixture: boolean): ProviderCost {
  const reported = isRecord(usage) ? usage : {};
  const inputTokens = tokenCount(reported.input_tokens);
  const outputTokens = tokenCount(reported.output_tokens);
  const units: Record<string, number> = { images: 1 };
  if (inputTokens !== null) units.input_tokens = inputTokens;
  if (outputTokens !== null) units.output_tokens = outputTokens;
  const known = inputTokens !== null && outputTokens !== null;
  return {
    provider: "openai_images",
    billedAs: `${OPENAI_IMAGE_MODEL} ${request.quality} ${request.size}${fixture ? FIXTURE_BILLED_AS_SUFFIX : ""}`,
    microUsd: known
      ? openAiImageSettleMicroUsd({ quality: request.quality, size: request.size, inputTokens, outputTokens })
      : openAiImageTableMicroUsd({ quality: request.quality, size: request.size }),
    estimated: !known,
    units,
    rateCard: OPENAI_IMAGE_RATES_EFFECTIVE_FROM,
  };
}

async function errorForStatus(response: Response): Promise<ProviderError> {
  const status = response.status;
  let code: unknown;
  try {
    const body: unknown = JSON.parse(await response.text());
    code = isRecord(body) && isRecord(body.error) ? body.error.code : undefined;
  } catch {
    code = undefined;
  }
  if (status === 400 && typeof code === "string" && MODERATION_CODES.includes(code)) {
    return new ProviderError("openai_images", "refusal", "the image prompt was blocked by moderation", {
      status,
      billed: "none",
    });
  }
  return new ProviderError("openai_images", kindForHttpStatus(status), `OpenAI Images returned ${status}`, { status });
}

export type OpenAiImagesAdapter = {
  readonly provider: "openai_images";
  generate(request: OpenAiImageRequest): Promise<ImageResult>;
};

export type OpenAiImagesAdapterOptions = {
  readonly env: ProviderEnv;
  /** Live mode only. Defaults to the global `fetch`. */
  readonly fetchImpl?: Fetcher;
  /** Fixture mode only: replaces the default fixture reply. */
  readonly fixtureResponder?: ImageFixtureResponder;
};

export function createOpenAiImagesAdapter(options: OpenAiImagesAdapterOptions): OpenAiImagesAdapter {
  return {
    provider: "openai_images",
    async generate(request: OpenAiImageRequest): Promise<ImageResult> {
      const body = buildOpenAiImageBody(request);
      const access = resolveProviderAccess("openai_images", options.env);
      const fixture = access.mode === "fixture";
      const fetchImpl: Fetcher =
        access.mode === "live" ? (options.fetchImpl ?? fetch) : fixtureOpenAiImagesFetch(options.fixtureResponder);
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (access.mode === "live") headers.authorization = `Bearer ${access.apiKey}`;

      const deadline = startDeadline("openai_images", request.timeoutMs, request.signal);
      try {
        let response: Response;
        try {
          response = await fetchImpl(OPENAI_IMAGES_ENDPOINT, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: deadline.signal,
          });
        } catch (error) {
          throw noReplyError("openai_images", deadline, error);
        }
        if (!response.ok) throw await errorForStatus(response);

        // A 2xx ran and was billed: every failure from here carries the cost.
        let payload: unknown;
        try {
          payload = JSON.parse(await response.text());
        } catch (cause) {
          if (deadline.timedOut() || deadline.parentAborted()) throw noReplyError("openai_images", deadline, cause);
          throw new ProviderError("openai_images", "invalid_output", "unparseable image response", {
            cost: imageCost(request, undefined, fixture),
            cause,
          });
        }
        const record = isRecord(payload) ? payload : {};
        const cost = imageCost(request, record.usage, fixture);
        const first = Array.isArray(record.data) && isRecord(record.data[0]) ? record.data[0] : {};
        const base = { provider: "openai_images" as const, model: OPENAI_IMAGE_MODEL, size: request.size, cost };
        if (typeof first.b64_json === "string" && first.b64_json.length > 0) {
          let bytes: Uint8Array;
          try {
            bytes = decodeBase64(first.b64_json);
          } catch (cause) {
            throw new ProviderError("openai_images", "invalid_output", "the image is not valid base64", { cost, cause });
          }
          if (!isPng(bytes)) {
            throw new ProviderError("openai_images", "invalid_output", "the image is not a PNG", { cost });
          }
          return { ...base, image: { kind: "bytes", bytes, mimeType: "image/png" } };
        }
        if (typeof first.url === "string" && first.url.startsWith("https://")) {
          return { ...base, image: { kind: "url", url: first.url } };
        }
        throw new ProviderError("openai_images", "invalid_output", "the response held no image", { cost });
      } finally {
        deadline.clear();
      }
    },
  };
}
