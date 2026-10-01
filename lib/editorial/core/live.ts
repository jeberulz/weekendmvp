import type { VerificationAuthority } from "../contracts/evidence";
import {
  hasFreshStrongAuth,
  type EditorialPrincipal,
  type HumanPrincipal,
  type IngestionPrincipal,
} from "../contracts/principal";
import type { CommandResult } from "../contracts/errors";
import type { ImportAck } from "../contracts/commands";
import type { SettingsView } from "../contracts/views";
import { principalView } from "./derive";
import { EditorialCore } from "./repository";
import type { ActorRef, CheckPolicy, CoreEnvironment, EditorialState, ReleaseCapability } from "./state";

/**
 * The live environment (WP46-E4): real accounts, nothing simulated.
 *
 * Until WP45's check library is connected (WP46-E5) checks cannot run, so
 * nothing can be approved; until the release worker exists (WP46-E6) every
 * release intent is refused. Both say so instead of pretending.
 */

export const LIVE_CHECK_POLICY: CheckPolicy = {
  label: "WP45 quality policy (not connected)",
  requiredCheckIds: [],
  run: null,
  unavailableReason:
    "Quality checks are not connected yet. They arrive with the idea-engine integration (WP46-E5), so nothing can be approved before then.",
};

export const LIVE_RELEASE_CAPABILITY: ReleaseCapability = {
  available: false,
  reason:
    "Publishing is not connected yet. The release worker arrives with WP46-E6; nothing was recorded and the public site is unchanged.",
};

export const LIVE_WORKER_ACTOR: ActorRef = { id: "release-worker", kind: "service", label: "Release worker" };

/** Policy version recorded while no WP45 policy is connected. */
export const LIVE_POLICY_VERSION_UNSET = "not-connected";

/**
 * Display counts are not measured here: the Markdown parser cannot load in
 * the Convex runtime, so the Next.js adapter measures returned revisions.
 */
export function liveEnvironment(
  seams: Partial<Pick<CoreEnvironment, "checks" | "releases" | "measure">> = {},
): CoreEnvironment {
  return {
    mode: "live",
    simulated: false,
    checks: seams.checks ?? LIVE_CHECK_POLICY,
    releases: seams.releases ?? LIVE_RELEASE_CAPABILITY,
    workerActor: LIVE_WORKER_ACTOR,
    measure: seams.measure ?? null,
  };
}

/** Facts about the deployment that only the backend knows. */
export type LiveSettingsContext = {
  /** When the super-admin capability was bound to this account (ISO), if it is. */
  boundAt: string | null;
};

/**
 * The live repository rules. Humans never present ingestion credentials:
 * submissions arrive through trusted backend code (an internal function)
 * that has already authenticated the producer and established the
 * verification authority, and calls `importTrusted`.
 */
export class LiveEditorialCore extends EditorialCore {
  constructor(
    state: EditorialState,
    principal: EditorialPrincipal | null,
    private readonly context: LiveSettingsContext,
  ) {
    super(state, principal);
  }

  protected resolveIngestion(): IngestionPrincipal | null {
    return null;
  }

  protected submissionAuthority(): VerificationAuthority {
    return "none";
  }

  /** For trusted backend callers only: the producer and authority are theirs to establish. */
  importTrusted(
    ingestion: IngestionPrincipal | null,
    envelope: unknown,
    authority: VerificationAuthority,
  ): Promise<CommandResult<ImportAck>> {
    return this.importAs(ingestion, envelope, authority);
  }

  protected describeSettings(editor: HumanPrincipal): SettingsView {
    const env = this.state.env;
    const releases = env.releases;
    return {
      mode: "live",
      principal: principalView(this.actor()),
      capability: {
        configured: this.context.boundAt !== null,
        verified: this.context.boundAt !== null,
        detail: this.context.boundAt
          ? `Super-admin capability bound to this account through deployment configuration on ${this.context.boundAt.slice(0, 10)}. Checked again on every request.`
          : "No super-admin capability is bound to this account.",
      },
      strongAuth: {
        at: editor.strongAuthAt,
        fresh: hasFreshStrongAuth(editor, this.state.clock.now()),
        mechanism:
          "A fresh sign-in with this account's own sign-in method within the last 10 minutes. Publishing, unpublishing, rollback, retry and trash ask for it.",
      },
      integrations: [
        {
          id: "auth",
          label: "Super-admin authentication",
          configured: this.context.boundAt !== null,
          verified: this.context.boundAt !== null,
          available: this.context.boundAt !== null,
          detail: "One account bound by deployment configuration; every page, read and command re-checks it.",
        },
        {
          id: "engine",
          label: "Idea engine submissions",
          configured: false,
          verified: false,
          available: false,
          detail: "Not connected. Needs WP45's frozen record contract and receipt validation (WP46-E5).",
        },
        {
          id: "legacy_import",
          label: "Legacy live-idea import",
          configured: false,
          verified: false,
          available: false,
          detail: "Not run. The read-only import inventory is WP46-E5.",
        },
        {
          id: "release_worker",
          label: "Release worker",
          configured: releases.available,
          verified: false,
          available: releases.available,
          detail: releases.available ? "Connected." : releases.reason,
        },
        {
          id: "public_site",
          label: "Public site visibility gate",
          configured: false,
          verified: false,
          available: false,
          detail: "Not built. Public pages ignore this workspace until WP46-E6.",
        },
      ],
      policy: {
        version: this.state.policyVersion,
        label: env.checks.label,
        requiredChecks: [...env.checks.requiredCheckIds],
      },
      publishing: {
        readiness: releases.available ? "ready" : "unavailable",
        killSwitchEngaged: this.state.killSwitchEngaged,
        detail: releases.available
          ? "Releases run through the release worker."
          : "Nothing can be published or unpublished from this workspace yet.",
      },
    };
  }
}
