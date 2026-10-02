import type { EditorialPrincipal } from "../../contracts/principal";
import type { EditorialRepository } from "../../contracts/repository";
import { seedFixtureScenarios, type FixtureScenarioIds, type SeedClock } from "../../fixtures/seed";
import { createDemoControls, type FixtureDemoControls } from "./demo";
import { FixtureEditorialRepository } from "./repository";
import { createEmptyState, type FixtureState } from "./state";

/**
 * The fixture adapter must never run in a production build. This check is
 * the second line of defence: the runtime selector only imports this module
 * behind a `NODE_ENV !== "production"` branch, which the bundler removes.
 */
export function assertFixtureModeAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Editorial fixture mode is unavailable in production builds.");
  }
}

export type FixtureEnvironment = {
  state: FixtureState;
  scenarios: FixtureScenarioIds;
  demo: FixtureDemoControls;
  clock: SeedClock;
  /** The local demo editor (simulated capability, not a real account). */
  editor(): EditorialRepository;
  /** Any principal, for authority tests (anonymous, customer, service). */
  as(principal: EditorialPrincipal | null): EditorialRepository;
};

/**
 * Seeding runs on a controlled clock. Afterwards the dev demo follows real
 * time; tests keep the clock pinned and move it explicitly.
 */
export function createSeedClock(): SeedClock & { followRealTime(): void } {
  let current: number | null = null;
  return {
    now: () => current ?? Date.now(),
    set: (ms) => {
      current = ms;
    },
    advance: (ms) => {
      current = (current ?? Date.now()) + ms;
    },
    followRealTime: () => {
      current = null;
    },
  };
}


export async function createFixtureEnvironment(options: { nowMs?: number } = {}): Promise<FixtureEnvironment> {
  assertFixtureModeAllowed();
  const referenceNow = options.nowMs ?? Date.now();
  const clock = createSeedClock();
  const state = createEmptyState(clock);
  const demo = createDemoControls(state);
  const editor = () => new FixtureEditorialRepository(state, state.editor);
  const scenarios = await seedFixtureScenarios({
    state,
    editor: editor(),
    demo,
    clock,
    // Seed history over the fortnight before "now".
    nowMs: referenceNow,
  });
  if (options.nowMs === undefined) clock.followRealTime();
  else clock.set(Math.max(clock.now(), referenceNow));
  return {
    state,
    scenarios,
    demo,
    clock,
    editor,
    as: (principal) => new FixtureEditorialRepository(state, principal),
  };
}
