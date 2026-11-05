import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("editorial release recovery", { minutes: 1 }, internal.editorial.worker.recover, {});
// Each tick can drain up to 20 bounded batches (1,000 rows) through immediate continuations.
crons.interval("workspace AI stale reservation sweep", { minutes: 10 }, internal.ai.metering.sweepStale, { limit: 50, remainingBatches: 19 });
crons.interval("workspace AI spend alarms", { minutes: 15 }, internal.ops.spend.checkDailyAlarms, {});
export default crons;
