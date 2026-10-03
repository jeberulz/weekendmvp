/**
 * Child-process smoke for F7, run by sourceText.transport.test.ts as
 * `node --experimental-strip-types http205.ts`. An HTTP 205 read through the
 * real transport must settle as `no_content`, and the process must then exit
 * 0 by itself: an uncaught exception crashes it (non-zero exit) and a pending
 * promise keeps the server open, so the parent's timeout catches a hang.
 */

import {
  createPublicOnlyFetch,
  createSourceTextProvider,
  SourceFetchError,
} from "../sourceText.ts";
import { loopbackLookup, PUBLIC_TEST_DNS, startServer } from "./harness.ts";

const server = await startServer((_req, res) => {
  res.writeHead(205);
  res.end();
});

let outcome: string;
try {
  const provider = createSourceTextProvider({
    fetchImpl: createPublicOnlyFetch({ lookup: loopbackLookup }),
    resolveHost: PUBLIC_TEST_DNS,
    timeoutMs: 5_000,
  });
  await provider.fetchText(`${server.origin("reset")}/`);
  outcome = "resolved";
} catch (error) {
  outcome = error instanceof SourceFetchError ? error.code : "unexpected error";
} finally {
  await server.close();
}

process.stdout.write(`${JSON.stringify({ outcome })}\n`);
if (outcome !== "no_content") process.exitCode = 1;
