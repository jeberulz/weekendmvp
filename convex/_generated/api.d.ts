/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as articles from "../articles.js";
import type * as ideas from "../ideas.js";
import type * as newsletter from "../newsletter.js";
import type * as payments from "../payments.js";
import type * as referenceTables from "../referenceTables.js";
import type * as revalidate from "../revalidate.js";
import type * as seed from "../seed.js";
import type * as subscriptions from "../subscriptions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  articles: typeof articles;
  ideas: typeof ideas;
  newsletter: typeof newsletter;
  payments: typeof payments;
  referenceTables: typeof referenceTables;
  revalidate: typeof revalidate;
  seed: typeof seed;
  subscriptions: typeof subscriptions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
