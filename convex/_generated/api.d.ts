/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountBeehiiv from "../accountBeehiiv.js";
import type * as admin_superAdmin from "../admin/superAdmin.js";
import type * as ai_budgets from "../ai/budgets.js";
import type * as ai_gateway from "../ai/gateway.js";
import type * as ai_gatewayActions from "../ai/gatewayActions.js";
import type * as ai_metering from "../ai/metering.js";
import type * as ai_pricing from "../ai/pricing.js";
import type * as ai_prompts_crewShared from "../ai/prompts/crewShared.js";
import type * as ai_prompts_entry from "../ai/prompts/entry.js";
import type * as ai_prompts_index from "../ai/prompts/index.js";
import type * as ai_prompts_registryProbe from "../ai/prompts/registryProbe.js";
import type * as ai_prompts_wrenChat from "../ai/prompts/wrenChat.js";
import type * as ai_prompts_wrenPlanTurn from "../ai/prompts/wrenPlanTurn.js";
import type * as ai_prompts_wrenShared from "../ai/prompts/wrenShared.js";
import type * as ai_providers_anthropic from "../ai/providers/anthropic.js";
import type * as ai_providers_fixtureOutputs from "../ai/providers/fixtureOutputs.js";
import type * as ai_providers_fixtures from "../ai/providers/fixtures.js";
import type * as ai_providers_mode from "../ai/providers/mode.js";
import type * as ai_providers_openaiImages from "../ai/providers/openaiImages.js";
import type * as ai_providers_recraft from "../ai/providers/recraft.js";
import type * as ai_providers_transport from "../ai/providers/transport.js";
import type * as ai_providers_types from "../ai/providers/types.js";
import type * as ai_registry from "../ai/registry.js";
import type * as ai_router from "../ai/router.js";
import type * as articles from "../articles.js";
import type * as auth from "../auth.js";
import type * as authEmail from "../authEmail.js";
import type * as authUser from "../authUser.js";
import type * as buildCta from "../buildCta.js";
import type * as crew_generators from "../crew/generators.js";
import type * as crew_jobs from "../crew/jobs.js";
import type * as crew_launch from "../crew/launch.js";
import type * as crew_launchRoster from "../crew/launchRoster.js";
import type * as crew_roles from "../crew/roles.js";
import type * as crew_roster from "../crew/roster.js";
import type * as crew_runner from "../crew/runner.js";
import type * as crew_steps from "../crew/steps.js";
import type * as crew_workpool from "../crew/workpool.js";
import type * as crons from "../crons.js";
import type * as currentUser from "../currentUser.js";
import type * as editorial_args from "../editorial/args.js";
import type * as editorial_audit from "../editorial/audit.js";
import type * as editorial_checkInputs from "../editorial/checkInputs.js";
import type * as editorial_checks from "../editorial/checks.js";
import type * as editorial_commands from "../editorial/commands.js";
import type * as editorial_ids from "../editorial/ids.js";
import type * as editorial_ingest from "../editorial/ingest.js";
import type * as editorial_public from "../editorial/public.js";
import type * as editorial_publication from "../editorial/publication.js";
import type * as editorial_readerTarget from "../editorial/readerTarget.js";
import type * as editorial_reads from "../editorial/reads.js";
import type * as editorial_service from "../editorial/service.js";
import type * as editorial_session from "../editorial/session.js";
import type * as editorial_store from "../editorial/store.js";
import type * as editorial_validators from "../editorial/validators.js";
import type * as editorial_worker from "../editorial/worker.js";
import type * as growth_connectors_types from "../growth/connectors/types.js";
import type * as growth_drafts_emailSequence from "../growth/drafts/emailSequence.js";
import type * as growth_email_caps from "../growth/email/caps.js";
import type * as growth_email_cleanup from "../growth/email/cleanup.js";
import type * as growth_email_contacts from "../growth/email/contacts.js";
import type * as growth_email_provider from "../growth/email/provider.js";
import type * as growth_email_tokens from "../growth/email/tokens.js";
import type * as http from "../http.js";
import type * as ideaFacets from "../ideaFacets.js";
import type * as ideaRequests from "../ideaRequests.js";
import type * as ideas from "../ideas.js";
import type * as live_signupSrc from "../live/signupSrc.js";
import type * as live_workshopBridge from "../live/workshopBridge.js";
import type * as live_workshopCheckout from "../live/workshopCheckout.js";
import type * as live_workshopEvents from "../live/workshopEvents.js";
import type * as live_workshopQueries from "../live/workshopQueries.js";
import type * as newsletter from "../newsletter.js";
import type * as ops_settings from "../ops/settings.js";
import type * as ops_spend from "../ops/spend.js";
import type * as payments from "../payments.js";
import type * as paymentsBridge from "../paymentsBridge.js";
import type * as platform_authz from "../platform/authz.js";
import type * as platform_billing_catalog from "../platform/billing/catalog.js";
import type * as platform_billing_checkout from "../platform/billing/checkout.js";
import type * as platform_billing_events from "../platform/billing/events.js";
import type * as platform_billing_grants from "../platform/billing/grants.js";
import type * as platform_billing_ledger from "../platform/billing/ledger.js";
import type * as platform_billing_provider from "../platform/billing/provider.js";
import type * as platform_billing_queries from "../platform/billing/queries.js";
import type * as platform_briefPayload from "../platform/briefPayload.js";
import type * as platform_catalogPolicy from "../platform/catalogPolicy.js";
import type * as platform_collections from "../platform/collections.js";
import type * as platform_compare from "../platform/compare.js";
import type * as platform_dashboard from "../platform/dashboard.js";
import type * as platform_engine_contracts from "../platform/engine/contracts.js";
import type * as platform_entitlements from "../platform/entitlements.js";
import type * as platform_forYou from "../platform/forYou.js";
import type * as platform_hubLimits from "../platform/hubLimits.js";
import type * as platform_ideaCards from "../platform/ideaCards.js";
import type * as platform_ideas from "../platform/ideas.js";
import type * as platform_intake from "../platform/intake.js";
import type * as platform_legacyIdeas from "../platform/legacyIdeas.js";
import type * as platform_libraryFilters from "../platform/libraryFilters.js";
import type * as platform_libraryResults from "../platform/libraryResults.js";
import type * as platform_limits from "../platform/limits.js";
import type * as platform_liveBuildRules from "../platform/liveBuildRules.js";
import type * as platform_liveBuilds from "../platform/liveBuilds.js";
import type * as platform_liveBuildsOperator from "../platform/liveBuildsOperator.js";
import type * as platform_membership_checkout from "../platform/membership/checkout.js";
import type * as platform_membership_cohortHash from "../platform/membership/cohortHash.js";
import type * as platform_membership_cohorts from "../platform/membership/cohorts.js";
import type * as platform_membership_comp from "../platform/membership/comp.js";
import type * as platform_membership_events from "../platform/membership/events.js";
import type * as platform_membership_offer from "../platform/membership/offer.js";
import type * as platform_membership_portal from "../platform/membership/portal.js";
import type * as platform_membership_provider from "../platform/membership/provider.js";
import type * as platform_membership_queries from "../platform/membership/queries.js";
import type * as platform_membership_seats from "../platform/membership/seats.js";
import type * as platform_membership_state from "../platform/membership/state.js";
import type * as platform_membership_validators from "../platform/membership/validators.js";
import type * as platform_membership_windows from "../platform/membership/windows.js";
import type * as platform_notes from "../platform/notes.js";
import type * as platform_planResolver from "../platform/planResolver.js";
import type * as platform_plans from "../platform/plans.js";
import type * as platform_preferences from "../platform/preferences.js";
import type * as platform_preview_capabilities from "../platform/preview/capabilities.js";
import type * as platform_preview_claim from "../platform/preview/claim.js";
import type * as platform_preview_customisation from "../platform/preview/customisation.js";
import type * as platform_preview_generate from "../platform/preview/generate.js";
import type * as platform_preview_read from "../platform/preview/read.js";
import type * as platform_preview_renderSpec from "../platform/preview/renderSpec.js";
import type * as platform_projects from "../platform/projects.js";
import type * as platform_promptPack from "../platform/promptPack.js";
import type * as platform_setupOptions from "../platform/setupOptions.js";
import type * as platform_setupValidators from "../platform/setupValidators.js";
import type * as platform_sites_leads from "../platform/sites/leads.js";
import type * as platform_sites_publish from "../platform/sites/publish.js";
import type * as platform_sites_read from "../platform/sites/read.js";
import type * as platform_sites_retention from "../platform/sites/retention.js";
import type * as platform_sites_takedown from "../platform/sites/takedown.js";
import type * as platform_sites_takedownState from "../platform/sites/takedownState.js";
import type * as platform_transitions from "../platform/transitions.js";
import type * as platform_validators from "../platform/validators.js";
import type * as platform_weekendPlans from "../platform/weekendPlans.js";
import type * as platform_weekendSteps from "../platform/weekendSteps.js";
import type * as referenceTables from "../referenceTables.js";
import type * as resendMagicLink from "../resendMagicLink.js";
import type * as revalidate from "../revalidate.js";
import type * as schema_ai from "../schema/ai.js";
import type * as schema_growth from "../schema/growth.js";
import type * as schema_workspace from "../schema/workspace.js";
import type * as seed from "../seed.js";
import type * as siteUrl from "../siteUrl.js";
import type * as subscriptions from "../subscriptions.js";
import type * as workspace_access from "../workspace/access.js";
import type * as workspace_approvals from "../workspace/approvals.js";
import type * as workspace_business from "../workspace/business.js";
import type * as workspace_changeRounds from "../workspace/changeRounds.js";
import type * as workspace_chat from "../workspace/chat.js";
import type * as workspace_chatActions from "../workspace/chatActions.js";
import type * as workspace_memory from "../workspace/memory.js";
import type * as workspace_signals from "../workspace/signals.js";
import type * as workspace_wizard from "../workspace/wizard.js";
import type * as workspace_wrenCards from "../workspace/wrenCards.js";
import type * as workspace_wrenMemory from "../workspace/wrenMemory.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountBeehiiv: typeof accountBeehiiv;
  "admin/superAdmin": typeof admin_superAdmin;
  "ai/budgets": typeof ai_budgets;
  "ai/gateway": typeof ai_gateway;
  "ai/gatewayActions": typeof ai_gatewayActions;
  "ai/metering": typeof ai_metering;
  "ai/pricing": typeof ai_pricing;
  "ai/prompts/crewShared": typeof ai_prompts_crewShared;
  "ai/prompts/entry": typeof ai_prompts_entry;
  "ai/prompts/index": typeof ai_prompts_index;
  "ai/prompts/registryProbe": typeof ai_prompts_registryProbe;
  "ai/prompts/wrenChat": typeof ai_prompts_wrenChat;
  "ai/prompts/wrenPlanTurn": typeof ai_prompts_wrenPlanTurn;
  "ai/prompts/wrenShared": typeof ai_prompts_wrenShared;
  "ai/providers/anthropic": typeof ai_providers_anthropic;
  "ai/providers/fixtureOutputs": typeof ai_providers_fixtureOutputs;
  "ai/providers/fixtures": typeof ai_providers_fixtures;
  "ai/providers/mode": typeof ai_providers_mode;
  "ai/providers/openaiImages": typeof ai_providers_openaiImages;
  "ai/providers/recraft": typeof ai_providers_recraft;
  "ai/providers/transport": typeof ai_providers_transport;
  "ai/providers/types": typeof ai_providers_types;
  "ai/registry": typeof ai_registry;
  "ai/router": typeof ai_router;
  articles: typeof articles;
  auth: typeof auth;
  authEmail: typeof authEmail;
  authUser: typeof authUser;
  buildCta: typeof buildCta;
  "crew/generators": typeof crew_generators;
  "crew/jobs": typeof crew_jobs;
  "crew/launch": typeof crew_launch;
  "crew/launchRoster": typeof crew_launchRoster;
  "crew/roles": typeof crew_roles;
  "crew/roster": typeof crew_roster;
  "crew/runner": typeof crew_runner;
  "crew/steps": typeof crew_steps;
  "crew/workpool": typeof crew_workpool;
  crons: typeof crons;
  currentUser: typeof currentUser;
  "editorial/args": typeof editorial_args;
  "editorial/audit": typeof editorial_audit;
  "editorial/checkInputs": typeof editorial_checkInputs;
  "editorial/checks": typeof editorial_checks;
  "editorial/commands": typeof editorial_commands;
  "editorial/ids": typeof editorial_ids;
  "editorial/ingest": typeof editorial_ingest;
  "editorial/public": typeof editorial_public;
  "editorial/publication": typeof editorial_publication;
  "editorial/readerTarget": typeof editorial_readerTarget;
  "editorial/reads": typeof editorial_reads;
  "editorial/service": typeof editorial_service;
  "editorial/session": typeof editorial_session;
  "editorial/store": typeof editorial_store;
  "editorial/validators": typeof editorial_validators;
  "editorial/worker": typeof editorial_worker;
  "growth/connectors/types": typeof growth_connectors_types;
  "growth/drafts/emailSequence": typeof growth_drafts_emailSequence;
  "growth/email/caps": typeof growth_email_caps;
  "growth/email/cleanup": typeof growth_email_cleanup;
  "growth/email/contacts": typeof growth_email_contacts;
  "growth/email/provider": typeof growth_email_provider;
  "growth/email/tokens": typeof growth_email_tokens;
  http: typeof http;
  ideaFacets: typeof ideaFacets;
  ideaRequests: typeof ideaRequests;
  ideas: typeof ideas;
  "live/signupSrc": typeof live_signupSrc;
  "live/workshopBridge": typeof live_workshopBridge;
  "live/workshopCheckout": typeof live_workshopCheckout;
  "live/workshopEvents": typeof live_workshopEvents;
  "live/workshopQueries": typeof live_workshopQueries;
  newsletter: typeof newsletter;
  "ops/settings": typeof ops_settings;
  "ops/spend": typeof ops_spend;
  payments: typeof payments;
  paymentsBridge: typeof paymentsBridge;
  "platform/authz": typeof platform_authz;
  "platform/billing/catalog": typeof platform_billing_catalog;
  "platform/billing/checkout": typeof platform_billing_checkout;
  "platform/billing/events": typeof platform_billing_events;
  "platform/billing/grants": typeof platform_billing_grants;
  "platform/billing/ledger": typeof platform_billing_ledger;
  "platform/billing/provider": typeof platform_billing_provider;
  "platform/billing/queries": typeof platform_billing_queries;
  "platform/briefPayload": typeof platform_briefPayload;
  "platform/catalogPolicy": typeof platform_catalogPolicy;
  "platform/collections": typeof platform_collections;
  "platform/compare": typeof platform_compare;
  "platform/dashboard": typeof platform_dashboard;
  "platform/engine/contracts": typeof platform_engine_contracts;
  "platform/entitlements": typeof platform_entitlements;
  "platform/forYou": typeof platform_forYou;
  "platform/hubLimits": typeof platform_hubLimits;
  "platform/ideaCards": typeof platform_ideaCards;
  "platform/ideas": typeof platform_ideas;
  "platform/intake": typeof platform_intake;
  "platform/legacyIdeas": typeof platform_legacyIdeas;
  "platform/libraryFilters": typeof platform_libraryFilters;
  "platform/libraryResults": typeof platform_libraryResults;
  "platform/limits": typeof platform_limits;
  "platform/liveBuildRules": typeof platform_liveBuildRules;
  "platform/liveBuilds": typeof platform_liveBuilds;
  "platform/liveBuildsOperator": typeof platform_liveBuildsOperator;
  "platform/membership/checkout": typeof platform_membership_checkout;
  "platform/membership/cohortHash": typeof platform_membership_cohortHash;
  "platform/membership/cohorts": typeof platform_membership_cohorts;
  "platform/membership/comp": typeof platform_membership_comp;
  "platform/membership/events": typeof platform_membership_events;
  "platform/membership/offer": typeof platform_membership_offer;
  "platform/membership/portal": typeof platform_membership_portal;
  "platform/membership/provider": typeof platform_membership_provider;
  "platform/membership/queries": typeof platform_membership_queries;
  "platform/membership/seats": typeof platform_membership_seats;
  "platform/membership/state": typeof platform_membership_state;
  "platform/membership/validators": typeof platform_membership_validators;
  "platform/membership/windows": typeof platform_membership_windows;
  "platform/notes": typeof platform_notes;
  "platform/planResolver": typeof platform_planResolver;
  "platform/plans": typeof platform_plans;
  "platform/preferences": typeof platform_preferences;
  "platform/preview/capabilities": typeof platform_preview_capabilities;
  "platform/preview/claim": typeof platform_preview_claim;
  "platform/preview/customisation": typeof platform_preview_customisation;
  "platform/preview/generate": typeof platform_preview_generate;
  "platform/preview/read": typeof platform_preview_read;
  "platform/preview/renderSpec": typeof platform_preview_renderSpec;
  "platform/projects": typeof platform_projects;
  "platform/promptPack": typeof platform_promptPack;
  "platform/setupOptions": typeof platform_setupOptions;
  "platform/setupValidators": typeof platform_setupValidators;
  "platform/sites/leads": typeof platform_sites_leads;
  "platform/sites/publish": typeof platform_sites_publish;
  "platform/sites/read": typeof platform_sites_read;
  "platform/sites/retention": typeof platform_sites_retention;
  "platform/sites/takedown": typeof platform_sites_takedown;
  "platform/sites/takedownState": typeof platform_sites_takedownState;
  "platform/transitions": typeof platform_transitions;
  "platform/validators": typeof platform_validators;
  "platform/weekendPlans": typeof platform_weekendPlans;
  "platform/weekendSteps": typeof platform_weekendSteps;
  referenceTables: typeof referenceTables;
  resendMagicLink: typeof resendMagicLink;
  revalidate: typeof revalidate;
  "schema/ai": typeof schema_ai;
  "schema/growth": typeof schema_growth;
  "schema/workspace": typeof schema_workspace;
  seed: typeof seed;
  siteUrl: typeof siteUrl;
  subscriptions: typeof subscriptions;
  "workspace/access": typeof workspace_access;
  "workspace/approvals": typeof workspace_approvals;
  "workspace/business": typeof workspace_business;
  "workspace/changeRounds": typeof workspace_changeRounds;
  "workspace/chat": typeof workspace_chat;
  "workspace/chatActions": typeof workspace_chatActions;
  "workspace/memory": typeof workspace_memory;
  "workspace/signals": typeof workspace_signals;
  "workspace/wizard": typeof workspace_wizard;
  "workspace/wrenCards": typeof workspace_wrenCards;
  "workspace/wrenMemory": typeof workspace_wrenMemory;
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
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  crewWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"crewWorkpool">;
  shardedCounter: import("@convex-dev/sharded-counter/_generated/component.js").ComponentApi<"shardedCounter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
