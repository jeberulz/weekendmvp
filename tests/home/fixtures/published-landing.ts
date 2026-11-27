import { resolve } from "node:path";

export const publishedLandingRoot = resolve("tests/home/fixtures/published-landing");

export async function withPublishedLanding<Copy>(
  read: (root: string) => Promise<Copy>,
  mock: (value: Copy) => { mockRestore(): void },
  verify: () => Promise<void>,
) {
  const spy = mock(await read(publishedLandingRoot));
  try {
    await verify();
  } finally {
    spy.mockRestore();
  }
}
