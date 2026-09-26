type SavedSnapshot = { signedIn: boolean; saved: boolean | null; version: number };

/** A compare-and-set fence prevents delayed HTTP requests reversing a newer choice. */
export function createVersionedSave(slug: string, initialVersion: number, request: typeof fetch = fetch) {
  let version = initialVersion;
  async function read() {
    const response = await request(`/api/platform/saved?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 ? "signed-out" : "unavailable");
    const latest = await response.json() as SavedSnapshot;
    if (!latest.signedIn) throw new Error("signed-out");
    if (typeof latest.saved !== "boolean" || !Number.isSafeInteger(latest.version) || latest.version < 0) throw new Error("unavailable");
    version = latest.version;
    return latest.saved;
  }
  async function write(saved: boolean, isCurrent: () => boolean) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await request("/api/platform/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, saved, expectedVersion: version }),
      });
      if (response.status === 409) {
        await read();
        // Let the queue write the latest choice instead of retrying an old one.
        if (!isCurrent()) throw new Error("superseded");
        continue;
      }
      if (!response.ok) throw new Error(response.status === 401 ? "signed-out" : "unavailable");
      const next = await response.json() as { version: number };
      if (!Number.isSafeInteger(next.version) || next.version < 0) throw new Error("unavailable");
      version = next.version;
      return;
    }
    throw new Error("conflict");
  }
  return { read, write };
}
