import { Workpool } from "@convex-dev/workpool";

import { components } from "../_generated/api";

/**
 * WP75-S2b — the client for the mounted `crewWorkpool` component
 * (`convex/convex.config.ts`).
 *
 * `maxParallelism` is the GLOBAL cap: crew actions running at once across
 * every founder. 10, because:
 * - each crew step is one `draft`-tier gateway run that can take most of an
 *   action's 10 minutes, so 10 slots is at most 10 Claude calls in flight from
 *   launches, which a burst of sign-ups queues behind instead of spiking spend
 *   (`02` §6.2);
 * - with the per-owner cap of 3 (`./launch.ts`), 10 slots still run three or
 *   four founders' launches side by side, and a single launch never waits on
 *   the global cap alone;
 * - it leaves the deployment's action concurrency for realtime work that is
 *   not on the pool (Wren chat, the wizard), well under the workpool README's
 *   suggested ceiling (20 on a free plan, 100 on Pro).
 * The meter (C-METER), budgets and credits still cap spend whatever this is.
 *
 * Workpool retries stay off for every crew step (`retry: false` at enqueue,
 * and not on by default here): retries belong to the runner's classes (S2a),
 * re-invoked by `stepDone`.
 */
export const CREW_MAX_PARALLELISM = 10;

export const crewWorkpool = new Workpool(components.crewWorkpool, {
  maxParallelism: CREW_MAX_PARALLELISM,
  retryActionsByDefault: false,
});
