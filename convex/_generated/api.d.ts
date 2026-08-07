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
import type * as platform_billing_catalog from "../platform/billing/catalog.js";
import type * as platform_billing_checkout from "../platform/billing/checkout.js";
import type * as platform_billing_events from "../platform/billing/events.js";
import type * as platform_billing_ledger from "../platform/billing/ledger.js";
import type * as platform_billing_provider from "../platform/billing/provider.js";
import type * as platform_billing_queries from "../platform/billing/queries.js";
import type * as platform_briefPayload from "../platform/briefPayload.js";
import type * as platform_engine_contracts from "../platform/engine/contracts.js";
import type * as platform_ideas from "../platform/ideas.js";
import type * as platform_intake from "../platform/intake.js";
import type * as platform_preview_capabilities from "../platform/preview/capabilities.js";
import type * as platform_preview_claim from "../platform/preview/claim.js";
import type * as platform_preview_customisation from "../platform/preview/customisation.js";
import type * as platform_preview_generate from "../platform/preview/generate.js";
import type * as platform_preview_read from "../platform/preview/read.js";
import type * as platform_preview_renderSpec from "../platform/preview/renderSpec.js";
import type * as platform_projects from "../platform/projects.js";
import type * as platform_sites_publish from "../platform/sites/publish.js";
import type * as platform_sites_read from "../platform/sites/read.js";
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
  "platform/billing/catalog": typeof platform_billing_catalog;
  "platform/billing/checkout": typeof platform_billing_checkout;
  "platform/billing/events": typeof platform_billing_events;
  "platform/billing/ledger": typeof platform_billing_ledger;
  "platform/billing/provider": typeof platform_billing_provider;
  "platform/billing/queries": typeof platform_billing_queries;
  "platform/briefPayload": typeof platform_briefPayload;
  "platform/engine/contracts": typeof platform_engine_contracts;
  "platform/ideas": typeof platform_ideas;
  "platform/intake": typeof platform_intake;
  "platform/preview/capabilities": typeof platform_preview_capabilities;
  "platform/preview/claim": typeof platform_preview_claim;
  "platform/preview/customisation": typeof platform_preview_customisation;
  "platform/preview/generate": typeof platform_preview_generate;
  "platform/preview/read": typeof platform_preview_read;
  "platform/preview/renderSpec": typeof platform_preview_renderSpec;
  "platform/projects": typeof platform_projects;
  "platform/sites/publish": typeof platform_sites_publish;
  "platform/sites/read": typeof platform_sites_read;
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

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
