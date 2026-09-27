/**
 * Durable batch spend ledger. A live run writes a $4 hold before dispatch
 * and settles it after the run. An interrupted process leaves the hold.
 */

import fs from "node:fs";
import path from "node:path";

import { assertBatchWithinCap } from "./cost.ts";

export const LEDGER_VERSION = 1;
export const LEDGER_LOCK_MS = 5_000;
export const LEDGER_STALE_LOCK_MS = 10_000;

export type LedgerHold = {
  id: string;
  microUsd: number;
  createdAt: string;
};

export type BatchLedger = {
  version: 1;
  spentMicroUsd: number;
  runs: number;
  holds: LedgerHold[];
};

export class LedgerCorruptError extends Error {
  readonly code = "LEDGER_CORRUPT";

  constructor(message: string) {
    super(message);
    this.name = "LedgerCorruptError";
  }
}

export class LedgerLockError extends Error {
  readonly code = "LEDGER_LOCK";

  constructor(message: string) {
    super(message);
    this.name = "LedgerLockError";
  }
}

export function emptyLedger(): BatchLedger {
  return { version: 1, spentMicroUsd: 0, runs: 0, holds: [] };
}

export function ledgerCommittedMicroUsd(ledger: BatchLedger): number {
  return (
    ledger.spentMicroUsd +
    ledger.holds.reduce((sum, hold) => sum + hold.microUsd, 0)
  );
}

function isHold(value: unknown): value is LedgerHold {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const hold = value as Record<string, unknown>;
  return (
    typeof hold.id === "string" &&
    hold.id.length > 0 &&
    typeof hold.microUsd === "number" &&
    Number.isFinite(hold.microUsd) &&
    hold.microUsd >= 0 &&
    typeof hold.createdAt === "string" &&
    hold.createdAt.length > 0
  );
}

export function parseBatchLedger(raw: string): BatchLedger {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LedgerCorruptError("batch spend ledger is not valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new LedgerCorruptError("batch spend ledger is not an object");
  }
  const row = parsed as Record<string, unknown>;
  if (row.version !== LEDGER_VERSION) {
    throw new LedgerCorruptError("batch spend ledger version is not 1");
  }
  if (
    typeof row.spentMicroUsd !== "number" ||
    !Number.isFinite(row.spentMicroUsd) ||
    row.spentMicroUsd < 0
  ) {
    throw new LedgerCorruptError("batch spend ledger spentMicroUsd is invalid");
  }
  if (typeof row.runs !== "number" || !Number.isFinite(row.runs) || row.runs < 0) {
    throw new LedgerCorruptError("batch spend ledger runs is invalid");
  }
  if (!Array.isArray(row.holds) || !row.holds.every(isHold)) {
    throw new LedgerCorruptError("batch spend ledger holds are invalid");
  }
  return {
    version: 1,
    spentMicroUsd: Math.ceil(row.spentMicroUsd),
    runs: Math.floor(row.runs),
    holds: row.holds.map((hold) => ({
      id: hold.id,
      microUsd: Math.ceil(hold.microUsd),
      createdAt: hold.createdAt,
    })),
  };
}

export function readBatchCommittedMicroUsd(filePath: string): number {
  return ledgerCommittedMicroUsd(readBatchLedger(filePath));
}

export function readBatchLedger(filePath: string): BatchLedger {
  if (!fs.existsSync(filePath)) return emptyLedger();
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new LedgerCorruptError("batch spend ledger could not be read");
  }
  if (raw.trim().length === 0) {
    throw new LedgerCorruptError("batch spend ledger is empty");
  }
  return parseBatchLedger(raw);
}

export function writeBatchLedgerAtomic(filePath: string, ledger: BatchLedger): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`);
  fs.renameSync(tmp, filePath);
}

function reclaimStaleLock(lockPath: string): void {
  try {
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (age > LEDGER_STALE_LOCK_MS) fs.unlinkSync(lockPath);
  } catch {
    // lock already gone
  }
}

export async function withLedgerLock<T>(
  filePath: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + LEDGER_LOCK_MS;
  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, `${process.pid}\n`);
      fs.closeSync(fd);
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      reclaimStaleLock(lockPath);
      if (Date.now() > deadline) {
        throw new LedgerLockError("timed out waiting for batch spend lock");
      }
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // another reclaim may have removed it
    }
  }
}

export async function reserveBatchRun(args: {
  filePath: string;
  runId: string;
  microUsd: number;
}): Promise<BatchLedger> {
  if (!Number.isFinite(args.microUsd) || args.microUsd <= 0) {
    throw new Error("reservation must be a positive finite number");
  }
  return withLedgerLock(args.filePath, () => {
    const ledger = readBatchLedger(args.filePath);
    if (ledger.holds.some((hold) => hold.id === args.runId)) return ledger;
    assertBatchWithinCap({
      batchSpentMicroUsd: ledgerCommittedMicroUsd(ledger),
      nextReservationMicroUsd: Math.ceil(args.microUsd),
    });
    ledger.holds.push({
      id: args.runId,
      microUsd: Math.ceil(args.microUsd),
      createdAt: new Date().toISOString(),
    });
    writeBatchLedgerAtomic(args.filePath, ledger);
    return ledger;
  });
}

export async function settleBatchRun(args: {
  filePath: string;
  runId: string;
  actualMicroUsd: number;
}): Promise<BatchLedger> {
  const charged =
    Number.isFinite(args.actualMicroUsd) && args.actualMicroUsd > 0
      ? Math.ceil(args.actualMicroUsd)
      : 0;
  return withLedgerLock(args.filePath, () => {
    const ledger = readBatchLedger(args.filePath);
    const hold = ledger.holds.find((row) => row.id === args.runId);
    if (!hold) return ledger;
    ledger.holds = ledger.holds.filter((row) => row.id !== args.runId);
    ledger.spentMicroUsd += charged;
    ledger.runs += 1;
    writeBatchLedgerAtomic(args.filePath, ledger);
    return ledger;
  });
}
