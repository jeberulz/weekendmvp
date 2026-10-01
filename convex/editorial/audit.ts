import type { MutationCtx } from "../_generated/server";
import { randomKey } from "./ids";
import type { StoredAuditRecord } from "./validators";

export type AuditInput = Omit<StoredAuditRecord, "key" | "at" | "correlationId"> & {
  correlationId?: string;
};

/**
 * Append one activity entry outside the editorial core (capability changes,
 * operator controls). Callers write it in the same transaction as the change
 * it describes, or — for a refusal — in a transaction that commits the
 * refusal record instead of rolling it back.
 */
export async function appendEditorialAudit(
  ctx: Pick<MutationCtx, "db">,
  entry: AuditInput,
  nowMs: number = Date.now(),
): Promise<StoredAuditRecord> {
  const record: StoredAuditRecord = {
    ...entry,
    key: randomKey("act"),
    at: new Date(nowMs).toISOString(),
    correlationId: entry.correlationId ?? randomKey("cor"),
  };
  await ctx.db.insert("editorial_audit", record);
  return record;
}
