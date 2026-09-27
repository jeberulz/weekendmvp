import { reserveBatchRun } from "./batch-ledger.ts";

const filePath = process.env.LEDGER_PATH;
const runId = process.env.LEDGER_RUN_ID;
const microUsd = Number(process.env.LEDGER_MICRO_USD);

if (!filePath || !runId || !Number.isFinite(microUsd)) {
  process.stderr.write("missing LEDGER_PATH, LEDGER_RUN_ID, or LEDGER_MICRO_USD\n");
  process.exit(2);
}

reserveBatchRun({ filePath, runId, microUsd })
  .then(() => {
    process.stdout.write("ok\n");
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.name : "Error"}\n`);
    process.exit(1);
  });
