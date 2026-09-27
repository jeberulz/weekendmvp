import { assertFixtureModeAllowed, createFixtureEnvironment, type FixtureEnvironment } from "./environment";

/**
 * One in-memory demo workspace per dev server process. Kept on `globalThis`
 * so hot reloads and the server-action and render module graphs share it.
 */
const KEY = Symbol.for("weekendmvp.editorial.fixture-environment");

type Holder = { promise: Promise<FixtureEnvironment> };

function holder(): { current?: Holder } {
  const scope = globalThis as unknown as Record<symbol, { current?: Holder } | undefined>;
  scope[KEY] ??= {};
  return scope[KEY];
}

export function getFixtureEnvironment(): Promise<FixtureEnvironment> {
  assertFixtureModeAllowed();
  const slot = holder();
  slot.current ??= { promise: createFixtureEnvironment() };
  return slot.current.promise;
}

/** Throw the demo away and seed it again (demo control). */
export function resetFixtureEnvironment(): Promise<FixtureEnvironment> {
  assertFixtureModeAllowed();
  const slot = holder();
  slot.current = { promise: createFixtureEnvironment() };
  return slot.current.promise;
}
