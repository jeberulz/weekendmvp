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
import type * as auth from "../auth.js";
import type * as authUser from "../authUser.js";
import type * as currentUser from "../currentUser.js";
import type * as http from "../http.js";
import type * as ideas from "../ideas.js";
import type * as newsletter from "../newsletter.js";
import type * as payments from "../payments.js";
import type * as platform_authz from "../platform/authz.js";
import type * as platform_ideas from "../platform/ideas.js";
import type * as platform_transitions from "../platform/transitions.js";
import type * as platform_validators from "../platform/validators.js";
import type * as referenceTables from "../referenceTables.js";
import type * as resendMagicLink from "../resendMagicLink.js";
import type * as revalidate from "../revalidate.js";
import type * as seed from "../seed.js";
import type * as siteUrl from "../siteUrl.js";
import type * as subscriptions from "../subscriptions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  articles: typeof articles;
  auth: typeof auth;
  authUser: typeof authUser;
  currentUser: typeof currentUser;
  http: typeof http;
  ideas: typeof ideas;
  newsletter: typeof newsletter;
  payments: typeof payments;
  "platform/authz": typeof platform_authz;
  "platform/ideas": typeof platform_ideas;
  "platform/transitions": typeof platform_transitions;
  "platform/validators": typeof platform_validators;
  referenceTables: typeof referenceTables;
  resendMagicLink: typeof resendMagicLink;
  revalidate: typeof revalidate;
  seed: typeof seed;
  siteUrl: typeof siteUrl;
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
