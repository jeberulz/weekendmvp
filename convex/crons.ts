import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("editorial release recovery", { minutes: 1 }, internal.editorial.worker.recover, {});
export default crons;
