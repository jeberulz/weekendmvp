/**
 * WP71-S3. One registry entry: a C-PROMPT spec plus what the version check
 * needs to fingerprint it.
 *
 * `buildUser` is a function, so its text cannot be read as data. The content
 * hash covers it three ways:
 * - `task.source`: `String(buildUser)`;
 * - `task.sample`: its output for `sampleInputs`;
 * - `module` (computed by `scripts/check-prompt-versions.mjs`): the source of
 *   the spec's module and every repo-local module it imports, so a helper, a
 *   constant on a branch the sample never reaches, or a `.refine()` on the
 *   output schema all change the hash.
 *
 * Imports carry explicit `.ts` extensions so `scripts/check-prompt-versions.mjs`
 * can load the registry under `node --experimental-strip-types`.
 */

import {
  definePromptSpec,
  PromptSpecError,
  type PromptSpec,
  type PromptSpecErrorCode,
} from "../../../lib/workspace/contracts/prompts.ts";

/**
 * A spec with its input type erased, so specs with different inputs share one
 * list. `buildUser(never)` accepts any typed `buildUser`; a caller that needs
 * the typed spec imports the spec module directly.
 */
export type RegisteredSpec = Readonly<PromptSpec<never, unknown>>;

export type PromptEntry = {
  readonly spec: RegisteredSpec;
  /** Repo-relative POSIX path of the module that defines the spec, e.g. `convex/ai/prompts/brandKit.ts`. */
  readonly module: string;
  /** Internal specs (registry probes, fixtures) are never a crew job's prompt. */
  readonly internal: boolean;
  /** `spec.buildUser(sampleInputs)`, bound at entry time with the typed input. */
  readonly renderSample: () => string;
};

export type PromptEntryOptions<TInput> = {
  /** Repo-relative POSIX path of the spec's module (checked by the version script). */
  readonly module: string;
  readonly sampleInputs: TInput;
  readonly internal?: boolean;
};

/** Every C-PROMPT spec field, in contract order. */
export const SPEC_KEYS = [
  "id",
  "version",
  "tier",
  "effort",
  "thinking",
  "maxTokens",
  "system",
  "buildUser",
  "outputSchema",
  "cacheLayout",
  "evalSuite",
  "mode",
  "purpose",
  "fallbacks",
] as const satisfies readonly (keyof PromptSpec<unknown, unknown>)[];

/** The nested settings objects, and the error code a non-plain value gets. */
const NESTED_KEYS: ReadonlyMap<string, PromptSpecErrorCode> = new Map([
  ["thinking", "INVALID_THINKING"],
  ["cacheLayout", "INVALID_CACHE_LAYOUT"],
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * A frozen deep copy of a plain object. Nested objects must be plain too: a
 * class instance, array or other exotic object could not be frozen as data and
 * could change after validation, so it throws `PromptSpecError(code)`.
 */
function plainCopy(value: Record<string, unknown>, code: PromptSpecErrorCode, label: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (typeof item === "object" && item !== null) {
      if (!isPlainObject(item)) throw new PromptSpecError(code, `${label}.${key} must be a plain object`);
      out[key] = plainCopy(item, code, `${label}.${key}`);
    } else {
      out[key] = item;
    }
  }
  return Object.freeze(out);
}

/**
 * A plain-data copy of a spec: each known C-PROMPT field is read exactly once,
 * from an own property only, and `thinking` / `cacheLayout` are copied and
 * frozen; a `thinking` / `cacheLayout` that is present but not a plain object
 * (a class instance, an array) throws `INVALID_THINKING` /
 * `INVALID_CACHE_LAYOUT`. Unknown fields (a smuggled `model`, say) are dropped. A getter that
 * changes its value between reads therefore cannot pass validation with one
 * value and register another, and a caller cannot mutate the nested objects
 * after registration.
 */
export function snapshotSpec(spec: object): Record<string, unknown> {
  const source = spec as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of SPEC_KEYS) {
    if (!Object.hasOwn(source, key)) continue;
    const value = source[key];
    const nestedCode = NESTED_KEYS.get(key);
    if (nestedCode === undefined) {
      out[key] = value;
    } else if (isPlainObject(value)) {
      out[key] = plainCopy(value, nestedCode, key);
    } else {
      throw new PromptSpecError(nestedCode, `${key} must be a plain object`);
    }
  }
  return out;
}

/** `definePromptSpec` on a snapshot: the frozen spec that was actually validated. */
export function validatedSpec<TInput, TOutput>(spec: Readonly<PromptSpec<TInput, TOutput>>): Readonly<PromptSpec<TInput, TOutput>> {
  return definePromptSpec(snapshotSpec(spec) as PromptSpec<TInput, TOutput>);
}

const MODULE_PATH = /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:ts|tsx|mts|js|mjs)$/u;

/** Throws unless `module` is a repo-relative POSIX source path with no `.` or `..` segment. */
export function assertModulePath(module: unknown): asserts module is string {
  if (
    typeof module !== "string" ||
    !MODULE_PATH.test(module) ||
    module.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new TypeError(`prompt entry module must be a repo-relative source path, got ${JSON.stringify(module)}`);
  }
}

export function promptEntry<TInput, TOutput>(
  spec: Readonly<PromptSpec<TInput, TOutput>>,
  options: PromptEntryOptions<TInput>,
): PromptEntry {
  assertModulePath(options.module);
  const safe = validatedSpec(spec);
  const { sampleInputs } = options;
  return Object.freeze({
    spec: safe,
    module: options.module,
    internal: options.internal === true,
    renderSample: () => safe.buildUser(sampleInputs),
  });
}
