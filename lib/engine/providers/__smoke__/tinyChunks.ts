/**
 * Child-process smoke for P2-1, run by sourceText.transport.test.ts as
 * `node --expose-gc --experimental-strip-types tinyChunks.ts`. A body one
 * byte under the 2 MiB body cap arrives as 1-byte chunked-encoding chunks,
 * about 12 MiB on the wire. The socket cap is raised so the read completes
 * and only memory is measured: heap plus ArrayBuffer bytes are sampled while
 * the body streams, and the peak above a collected baseline is printed.
 * Keeping every chunk as its own Buffer cost more than 300 MiB here; one
 * growing body buffer costs a few MiB.
 */

import net from "node:net";

import { createPublicOnlyFetch } from "../sourceText.ts";
import { loopbackLookup } from "./harness.ts";

const MiB = 1024 * 1024;
const BODY_BYTES = 2 * MiB - 1;

const exposed: unknown = Reflect.get(globalThis, "gc");
if (typeof exposed !== "function") {
  process.stdout.write(`${JSON.stringify({ error: "run with --expose-gc" })}\n`);
  process.exit(2);
}
const gc = exposed as () => void;

const unit = Buffer.from("1\r\na\r\n");
const terminator = Buffer.from("0\r\n\r\n");
const wire = Buffer.alloc(unit.length * BODY_BYTES + terminator.length);
for (let i = 0; i < BODY_BYTES; i += 1) unit.copy(wire, i * unit.length);
terminator.copy(wire, unit.length * BODY_BYTES);

const server = net.createServer((socket) => {
  socket.on("error", () => undefined); // the client may hang up mid-write
  socket.once("data", () => {
    socket.write("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nTransfer-Encoding: chunked\r\n\r\n");
    socket.end(wire);
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (address === null || typeof address === "string") throw new Error("no TCP port");

const used = () => {
  const memory = process.memoryUsage();
  return memory.heapUsed + memory.arrayBuffers;
};

gc();
const baseline = used();
let peak = baseline;
const sampler = setInterval(() => {
  peak = Math.max(peak, used());
}, 5);

const fetch = createPublicOnlyFetch({ lookup: loopbackLookup, limits: { maxSocketBytes: 64 * MiB } });
const outcome = await fetch(`http://tiny.source.test:${address.port}/`).then(
  async (response) => `read ${(await response.arrayBuffer()).byteLength} bytes`,
  (error: unknown) => `rejected ${error instanceof Error ? error.message : String(error)}`,
);
clearInterval(sampler);
peak = Math.max(peak, used());
await new Promise<void>((resolve) => server.close(() => resolve()));

process.stdout.write(
  `${JSON.stringify({ outcome, wireBytes: wire.length, peakMiB: Math.round((peak - baseline) / MiB) })}\n`,
);
