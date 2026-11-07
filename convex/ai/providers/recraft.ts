/**
 * WP71-S1. Image adapter for Recraft V4.1, raw `fetch`.
 *
 * D11: logo marks and brand-consistent work render here; D4 amendment: logo
 * marks must stay on Recraft for the 11-credit brand kit regenerate.
 *
 * Only priced sizes are accepted: 1024×1024 (raster, $0.035 list price). V4.1
 * rejects 1536×1024, which the WP69-S4 spike hit; the type and the runtime
 * check both refuse it before anything is sent. The cost is the flat list
 * price (`estimated: true`) until a live Recraft call is measured.
 *
 * `styleId` (the brand style, `RECRAFT_STYLE_ID`) is passed through when the
 * caller sets it; this file never reads env for it.
 *
 * The model id (`recraftv4_1`), endpoint and body follow the WP69 spike's
 * Recraft request (`scripts/spikes/wp69/media.ts`), including
 * `image_format: "png"`. Bytes that are not a PNG are `invalid_output`.
 * Fixture results carry `billedAs` ending in ` (fixture)`.
 *
 * WP67-S7: `model` picks V4.1 (`recraftv4_1`, the default) or V4.1 Flash
 * (`recraftv4_1_flash`, $0.007). Only priced models are accepted, and Flash
 * refuses `styleId` before anything is sent: Recraft's API does not take
 * styles on Flash. There is no other provider behind this adapter, so a
 * refused or failed Flash call never falls back to OpenAI images.
 */

import {
  isRecraftModel,
  RECRAFT_FLASH_MODEL,
  RECRAFT_MODEL,
  RECRAFT_MODEL_RATES_EFFECTIVE_FROM,
  RECRAFT_PRICES_MICRO_USD,
  recraftCostMicroUsd,
  type RecraftModel,
  type RecraftSize,
} from "../pricing";
import { fixtureRecraftFetch, type ImageFixtureResponder } from "./fixtures";
import { resolveProviderAccess, type ProviderEnv } from "./mode";
import { decodeBase64, isPng, isRecord, kindForHttpStatus, noReplyError, RECRAFT_ENDPOINT, startDeadline } from "./transport";
import { FIXTURE_BILLED_AS_SUFFIX, ProviderError, type Fetcher, type ImageRequestBase, type ImageResult, type ProviderCost } from "./types";

export { RECRAFT_ENDPOINT };

export type RecraftImageRequest = ImageRequestBase & {
  readonly size: RecraftSize;
  readonly styleId?: string;
  /** Defaults to `recraftv4_1`. */
  readonly model?: RecraftModel;
};

/** The model a request will be sent and billed as. */
export function recraftModelFor(request: Pick<RecraftImageRequest, "model">): RecraftModel {
  return request.model ?? RECRAFT_MODEL;
}

function configError(message: string): ProviderError {
  return new ProviderError("recraft", "config", message);
}

/** Whether a size is one we price (and so accept). */
export function isRecraftSize(size: string): size is RecraftSize {
  return Object.hasOwn(RECRAFT_PRICES_MICRO_USD, size);
}

export function assertRecraftRequest(request: RecraftImageRequest): void {
  const model: string = recraftModelFor(request);
  if (!isRecraftModel(model)) throw configError(`Recraft model ${model} is not supported`);
  if (!isRecraftSize(request.size)) {
    throw configError(`Recraft size ${String(request.size)} is not supported; use one of ${Object.keys(RECRAFT_PRICES_MICRO_USD).join(", ")}`);
  }
  if (request.prompt.trim().length === 0) throw configError("the image prompt is empty");
  if (request.styleId !== undefined && request.styleId.trim().length === 0) {
    throw configError("styleId must be a non-empty Recraft style id when set");
  }
  if (model === RECRAFT_FLASH_MODEL && request.styleId !== undefined) {
    throw configError("Recraft V4.1 Flash does not accept a styleId");
  }
}

export function buildRecraftBody(request: RecraftImageRequest): Record<string, unknown> {
  assertRecraftRequest(request);
  return {
    prompt: request.prompt,
    model: recraftModelFor(request),
    size: request.size,
    n: 1,
    response_format: "b64_json",
    image_format: "png",
    ...(request.styleId === undefined ? {} : { style_id: request.styleId.trim() }),
  };
}

function imageCost(request: RecraftImageRequest, fixture: boolean): ProviderCost {
  const model = recraftModelFor(request);
  return {
    provider: "recraft",
    billedAs: `${model} ${request.size}${fixture ? FIXTURE_BILLED_AS_SUFFIX : ""}`,
    microUsd: recraftCostMicroUsd({ size: request.size, model }),
    estimated: true,
    units: { images: 1 },
    rateCard: RECRAFT_MODEL_RATES_EFFECTIVE_FROM[model],
  };
}

export type RecraftAdapter = {
  readonly provider: "recraft";
  generate(request: RecraftImageRequest): Promise<ImageResult>;
};

export type RecraftAdapterOptions = {
  readonly env: ProviderEnv;
  /** Live mode only. Defaults to the global `fetch`. */
  readonly fetchImpl?: Fetcher;
  /** Fixture mode only: replaces the default fixture reply. */
  readonly fixtureResponder?: ImageFixtureResponder;
};

export function createRecraftAdapter(options: RecraftAdapterOptions): RecraftAdapter {
  return {
    provider: "recraft",
    async generate(request: RecraftImageRequest): Promise<ImageResult> {
      const body = buildRecraftBody(request);
      const access = resolveProviderAccess("recraft", options.env);
      const fetchImpl: Fetcher =
        access.mode === "live" ? (options.fetchImpl ?? fetch) : fixtureRecraftFetch(options.fixtureResponder);
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (access.mode === "live") headers.authorization = `Bearer ${access.apiKey}`;

      const deadline = startDeadline("recraft", request.timeoutMs, request.signal);
      try {
        let response: Response;
        try {
          response = await fetchImpl(RECRAFT_ENDPOINT, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: deadline.signal,
          });
        } catch (error) {
          throw noReplyError("recraft", deadline, error);
        }
        if (!response.ok) {
          throw new ProviderError("recraft", kindForHttpStatus(response.status), `Recraft returned ${response.status}`, {
            status: response.status,
          });
        }

        const cost = imageCost(request, access.mode === "fixture");
        let payload: unknown;
        try {
          payload = JSON.parse(await response.text());
        } catch (cause) {
          if (deadline.timedOut() || deadline.parentAborted()) throw noReplyError("recraft", deadline, cause);
          throw new ProviderError("recraft", "invalid_output", "unparseable Recraft response", { cost, cause });
        }
        const record = isRecord(payload) ? payload : {};
        const first = Array.isArray(record.data) && isRecord(record.data[0]) ? record.data[0] : {};
        const base = { provider: "recraft" as const, model: recraftModelFor(request), size: request.size, cost };
        if (typeof first.b64_json === "string" && first.b64_json.length > 0) {
          let bytes: Uint8Array;
          try {
            bytes = decodeBase64(first.b64_json);
          } catch (cause) {
            throw new ProviderError("recraft", "invalid_output", "the image is not valid base64", { cost, cause });
          }
          if (!isPng(bytes)) throw new ProviderError("recraft", "invalid_output", "the image is not a PNG", { cost });
          return { ...base, image: { kind: "bytes", bytes, mimeType: "image/png" } };
        }
        if (typeof first.url === "string" && first.url.startsWith("https://")) {
          return { ...base, image: { kind: "url", url: first.url } };
        }
        throw new ProviderError("recraft", "invalid_output", "the response held no image", { cost });
      } finally {
        deadline.clear();
      }
    },
  };
}
