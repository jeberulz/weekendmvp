export function createPreviewLimiter(limit = 6, windowMs = 60_000) {
  let calls: number[] = [];
  return (now = Date.now()) => {
    calls = calls.filter((time) => now - time < windowMs);
    if (calls.length >= limit) return Math.max(1, Math.ceil((calls[0] + windowMs - now) / 1000));
    calls.push(now);
    return 0;
  };
}

// One bound landing editor shares this per-process limit.
export const limitPreview = createPreviewLimiter();
