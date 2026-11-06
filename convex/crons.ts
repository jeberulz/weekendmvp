import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
const DAY_MS = 24 * 60 * 60 * 1000;
crons.interval("editorial release recovery", { minutes: 1 }, internal.editorial.worker.recover, {});
// Each tick can drain up to 20 bounded batches (1,000 rows) through immediate continuations.
crons.interval("workspace AI stale reservation sweep", { minutes: 10 }, internal.ai.metering.sweepStale, { limit: 50, remainingBatches: 19 });
crons.interval("workspace AI spend alarms", { minutes: 15 }, internal.ops.spend.checkDailyAlarms, {});
// Retention cleanup cannot enqueue mail and continues after the workspace or
// tenant email switch is turned off. Component defaults are pinned here.
crons.daily("tenant email finalized cleanup", { hourUTC: 2, minuteUTC: 15 },
  internal.growth.email.cleanup.finalized, { olderThan: 7 * DAY_MS });
crons.daily("tenant email abandoned cleanup", { hourUTC: 2, minuteUTC: 45 },
  internal.growth.email.cleanup.abandoned, { olderThan: 30 * DAY_MS });
export default crons;
