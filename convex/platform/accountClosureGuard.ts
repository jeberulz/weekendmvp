import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/** Read in the same mutation that would create a new owned project. */
export function assertAccountOpenForProjectCreation(user: Doc<"users">): void {
  if (user.accountClosureRequestedAt !== undefined) {
    throw new ConvexError({ code: "ACCOUNT_CLOSURE_ALREADY_REQUESTED" });
  }
}
