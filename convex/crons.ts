import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("editorial release recovery", { minutes: 1 }, internal.editorial.worker.recover, {});
crons.interval("workspace AI stale reservation sweep", { minutes: 10 }, internal.ai.metering.sweepStale, { limit: 50 });
crons.interval("workspace AI spend alarms", { minutes: 15 }, internal.ops.spend.checkDailyAlarms, {});
export default crons;
