import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
const DAY_MS = 24 * 60 * 60 * 1000;
crons.interval("editorial release recovery", { minutes: 1 }, internal.editorial.worker.recover, {});
// Each tick can drain up to 20 bounded batches (1,000 rows) through immediate continuations.
crons.interval("workspace AI stale reservation sweep", { minutes: 10 }, internal.ai.metering.sweepStale, { limit: 50, remainingBatches: 19 });
crons.interval("workspace AI spend alarms", { minutes: 15 }, internal.ops.spend.checkDailyAlarms, {});
// Settle expired crew leases through the existing bounded recovery worker.
crons.interval("workspace crew run recovery", { minutes: 5 }, internal.crew.jobs.recoverStaleCrewRuns, {});
// Retention cleanup cannot enqueue mail and continues after the workspace or
// tenant email switch is turned off. Component defaults are pinned here.
crons.cron("tenant email finalized cleanup", "15 2 * * *",
  internal.growth.email.cleanup.finalized, { olderThan: 7 * DAY_MS });
crons.cron("tenant email abandoned cleanup", "45 2 * * *",
  internal.growth.email.cleanup.abandoned, { olderThan: 30 * DAY_MS });
// Persisted privacy jobs remain recoverable even if scheduled calls are lost.
crons.interval("tenant lead retention and closure recovery", { hours: 1 },
  internal.growth.email.retentionDriver.sweep, {});
export default crons;
