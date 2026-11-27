const localWrites = globalThis as typeof globalThis & { landingEditorWriteTail?: Promise<void> };

/** Serialise edits within the local editor server, including Keystatic saves. */
export async function withLocalEditorWrite<T>(write: () => Promise<T>): Promise<T> {
  const previous = localWrites.landingEditorWriteTail;
  let release!: () => void;
  localWrites.landingEditorWriteTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await write();
  } finally {
    release();
  }
}
