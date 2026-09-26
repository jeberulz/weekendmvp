/** Serializes writes while coalescing clicks to the newest requested state. */
export function createSaveQueue(options: {
  initial: boolean;
  write: (saved: boolean, isCurrent: () => boolean) => Promise<void>;
  read: () => Promise<boolean>;
  changed: (saved: boolean, pending: boolean) => void;
  settled: (saved: boolean) => void;
  failed: (error: unknown) => void;
}) {
  let confirmed = options.initial;
  let desired = confirmed;
  let lastRequested = desired;
  let revision = 0;
  let running = false;
  let dirty = false;
  let disposed = false;

  async function drain() {
    if (running || disposed) return;
    running = true;
    let failed = false;
    while (!disposed && dirty) {
      dirty = false;
      const saving = desired;
      const attemptedRevision = revision;
      try {
        await options.write(saving, () => revision === attemptedRevision && !disposed);
        confirmed = saving;
        dirty = desired !== confirmed;
      } catch (error) {
        if (disposed) break;
        // A failure must not undo a click that happened after this request.
        if (revision === attemptedRevision) {
          let reconciled = false;
          try { confirmed = await options.read(); reconciled = true; } catch { /* Keep the requested state with an explicit error until retry. */ }
          if (disposed) break;
          if (revision !== attemptedRevision) { dirty = true; continue; }
          if (reconciled) desired = confirmed;
          if (reconciled && confirmed === saving) continue;
          failed = true;
          options.failed(error);
          break;
        }
      }
    }
    running = false;
    if (!disposed) {
      options.changed(desired, false);
      if (!failed && desired === confirmed) options.settled(confirmed);
    }
  }

  return {
    toggle() {
      desired = !desired;
      lastRequested = desired;
      revision += 1;
      dirty = true;
      options.changed(desired, true);
      void drain();
    },
    retry() {
      desired = lastRequested;
      revision += 1;
      dirty = true;
      options.changed(desired, true);
      void drain();
    },
    dispose() { disposed = true; },
  };
}
