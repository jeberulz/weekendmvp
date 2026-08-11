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
import type * as platform_engine_executor from "../platform/engine/executor.js";
import type * as platform_engine_pipeline from "../platform/engine/pipeline.js";
import type * as platform_engine_providers_fixtures from "../platform/engine/providers/fixtures.js";
import type * as platform_engine_providers_keywordData from "../platform/engine/providers/keywordData.js";
import type * as platform_engine_providers_openai from "../platform/engine/providers/openai.js";
import type * as platform_engine_providers_perplexity from "../platform/engine/providers/perplexity.js";
import type * as platform_engine_providers_pricing from "../platform/engine/providers/pricing.js";
import type * as platform_engine_providers_registry from "../platform/engine/providers/registry.js";
import type * as platform_engine_providers_types from "../platform/engine/providers/types.js";
import type * as platform_engine_reconcile from "../platform/engine/reconcile.js";
import type * as platform_engine_steps_briefNormalization from "../platform/engine/steps/briefNormalization.js";
import type * as platform_engine_steps_communitySignals from "../platform/engine/steps/communitySignals.js";
import type * as platform_engine_steps_competitors from "../platform/engine/steps/competitors.js";
import type * as platform_engine_steps_keywordsDemand from "../platform/engine/steps/keywordsDemand.js";
import type * as platform_engine_steps_marketStats from "../platform/engine/steps/marketStats.js";
import type * as platform_engine_steps_reportRender from "../platform/engine/steps/reportRender.js";
import type * as platform_engine_steps_runner from "../platform/engine/steps/runner.js";
import type * as platform_engine_steps_shared from "../platform/engine/steps/shared.js";
import type * as platform_engine_steps_synthesisScoring from "../platform/engine/steps/synthesisScoring.js";
import type * as platform_engine_tasks from "../platform/engine/tasks.js";
import type * as platform_engine_workflow from "../platform/engine/workflow.js";
import type * as platform_ideas from "../platform/ideas.js";
import type * as platform_intake from "../platform/intake.js";
import type * as platform_projects from "../platform/projects.js";
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
  "platform/engine/executor": typeof platform_engine_executor;
  "platform/engine/pipeline": typeof platform_engine_pipeline;
  "platform/engine/providers/fixtures": typeof platform_engine_providers_fixtures;
  "platform/engine/providers/keywordData": typeof platform_engine_providers_keywordData;
  "platform/engine/providers/openai": typeof platform_engine_providers_openai;
  "platform/engine/providers/perplexity": typeof platform_engine_providers_perplexity;
  "platform/engine/providers/pricing": typeof platform_engine_providers_pricing;
  "platform/engine/providers/registry": typeof platform_engine_providers_registry;
  "platform/engine/providers/types": typeof platform_engine_providers_types;
  "platform/engine/reconcile": typeof platform_engine_reconcile;
  "platform/engine/steps/briefNormalization": typeof platform_engine_steps_briefNormalization;
  "platform/engine/steps/communitySignals": typeof platform_engine_steps_communitySignals;
  "platform/engine/steps/competitors": typeof platform_engine_steps_competitors;
  "platform/engine/steps/keywordsDemand": typeof platform_engine_steps_keywordsDemand;
  "platform/engine/steps/marketStats": typeof platform_engine_steps_marketStats;
  "platform/engine/steps/reportRender": typeof platform_engine_steps_reportRender;
  "platform/engine/steps/runner": typeof platform_engine_steps_runner;
  "platform/engine/steps/shared": typeof platform_engine_steps_shared;
  "platform/engine/steps/synthesisScoring": typeof platform_engine_steps_synthesisScoring;
  "platform/engine/tasks": typeof platform_engine_tasks;
  "platform/engine/workflow": typeof platform_engine_workflow;
  "platform/ideas": typeof platform_ideas;
  "platform/intake": typeof platform_intake;
  "platform/projects": typeof platform_projects;
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
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
