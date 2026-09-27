import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BatchCapExceededError } from "./cost.ts";
import {
  LedgerCorruptError,
  emptyLedger,
  ledgerCommittedMicroUsd,
  readBatchCommittedMicroUsd,
  readBatchLedger,
  reserveBatchRun,
  settleBatchRun,
  writeBatchLedgerAtomic,
} from "./batch-ledger.ts";

const worker = fileURLToPath(
  new URL("./batch-ledger-worker.ts", import.meta.url),
);

function tmpLedger(): string {
  return path.join(os.tmpdir(), `wmvp-ledger-${Date.now()}-${Math.random()}.json`);
}

function reserveChild(filePath: string, runId: string, microUsd: number) {
  return spawn(
    process.execPath,
    ["--experimental-strip-types", worker],
    {
      env: {
        ...process.env,
        LEDGER_PATH: filePath,
        LEDGER_RUN_ID: runId,
        LEDGER_MICRO_USD: String(microUsd),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

function waitChild(child: ReturnType<typeof spawn>): Promise<{
  code: number | null;
  stderr: string;
}> {
  return new Promise((resolve) => {
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

describe("batch ledger", () => {
  it("treats a missing file as empty and fail-closes on truncated JSON", () => {
    const filePath = tmpLedger();
    expect(readBatchCommittedMicroUsd(filePath)).toBe(0);
    fs.writeFileSync(filePath, '{ "spentMicroUsd": 12000000');
    expect(() => readBatchLedger(filePath)).toThrow(LedgerCorruptError);
    expect(() => readBatchCommittedMicroUsd(filePath)).toThrow(LedgerCorruptError);
    fs.unlinkSync(filePath);
  });

  it("refuses paid work when an existing ledger is invalid", async () => {
    const filePath = tmpLedger();
    fs.writeFileSync(filePath, '{"version":1,"spentMicroUsd":-1,"runs":0,"holds":[]}');
    await expect(
      reserveBatchRun({ filePath, runId: "run-a", microUsd: 4_000_000 }),
    ).rejects.toThrow(LedgerCorruptError);
    fs.unlinkSync(filePath);
  });

  it("serializes two $4 reservations against a $28 ledger", async () => {
    const filePath = tmpLedger();
    writeBatchLedgerAtomic(filePath, {
      ...emptyLedger(),
      spentMicroUsd: 28_000_000,
    });
    const first = await reserveBatchRun({
      filePath,
      runId: "run-a",
      microUsd: 4_000_000,
    });
    expect(ledgerCommittedMicroUsd(first)).toBe(32_000_000);
    await expect(
      reserveBatchRun({ filePath, runId: "run-b", microUsd: 4_000_000 }),
    ).rejects.toThrow(BatchCapExceededError);
    const afterKill = readBatchLedger(filePath);
    expect(afterKill.holds.map((hold) => hold.id)).toEqual(["run-a"]);
    expect(ledgerCommittedMicroUsd(afterKill)).toBe(32_000_000);
    fs.unlinkSync(filePath);
  });

  it("keeps an unresolved hold after dispatch without settle", async () => {
    const filePath = tmpLedger();
    await reserveBatchRun({
      filePath,
      runId: "killed-run",
      microUsd: 4_000_000,
    });
    const held = readBatchLedger(filePath);
    expect(held.spentMicroUsd).toBe(0);
    expect(held.holds).toHaveLength(1);
    expect(ledgerCommittedMicroUsd(held)).toBe(4_000_000);
    await expect(
      reserveBatchRun({ filePath, runId: "next", microUsd: 29_000_000 }),
    ).rejects.toThrow(BatchCapExceededError);
    fs.unlinkSync(filePath);
  });

  it("settles a hold into spent and ignores a second settle", async () => {
    const filePath = tmpLedger();
    await reserveBatchRun({ filePath, runId: "run-a", microUsd: 4_000_000 });
    await settleBatchRun({
      filePath,
      runId: "run-a",
      actualMicroUsd: 120_000,
    });
    expect(readBatchLedger(filePath)).toMatchObject({
      spentMicroUsd: 120_000,
      runs: 1,
      holds: [],
    });
    await settleBatchRun({
      filePath,
      runId: "run-a",
      actualMicroUsd: 120_000,
    });
    expect(readBatchCommittedMicroUsd(filePath)).toBe(120_000);
    fs.unlinkSync(filePath);
  });

  it("lets only one of two concurrent $32 reservations win", async () => {
    const filePath = tmpLedger();
    const a = reserveChild(filePath, "proc-a", 32_000_000);
    const b = reserveChild(filePath, "proc-b", 32_000_000);
    const [first, second] = await Promise.all([waitChild(a), waitChild(b)]);
    const codes = [first.code, second.code].sort();
    expect(codes).toEqual([0, 1]);
    const loser = first.code === 1 ? first : second;
    expect(loser.stderr).toMatch(/BatchCapExceededError|LedgerLockError/);
    const ledger = readBatchLedger(filePath);
    expect(ledger.holds).toHaveLength(1);
    expect(ledgerCommittedMicroUsd(ledger)).toBe(32_000_000);
    fs.unlinkSync(filePath);
  });
});
