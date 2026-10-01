import type { VerificationAuthority } from "../../contracts/evidence";
import {
  hasFreshStrongAuth,
  type EditorialPrincipal,
  type HumanPrincipal,
  type IngestionCredential,
  type IngestionPrincipal,
} from "../../contracts/principal";
import type { SettingsView } from "../../contracts/views";
import { principalView } from "../../core/derive";
import { EditorialCore } from "../../core/repository";
import { appendAudit, nowIso, touch, type IdeaRecord, type RevisionRecord } from "../../core/state";
import type { FixtureState } from "./state";

/**
 * The local-demo repository: the shared editorial core over one in-memory
 * state, with simulated ingestion credentials, simulated verification and a
 * simulated "edit from another tab".
 */
export class FixtureEditorialRepository extends EditorialCore {
  constructor(
    private readonly fixture: FixtureState,
    principal: EditorialPrincipal | null,
  ) {
    super(fixture, principal);
  }

  protected resolveIngestion(credential: IngestionCredential): IngestionPrincipal | null {
    return this.fixture.ingestionTokens.get(credential.token) ?? null;
  }

  protected submissionAuthority(): VerificationAuthority {
    return "fixture_simulated";
  }

  /** Fixture scenario: another session saves first, so this save conflicts. */
  protected beforeSave(idea: IdeaRecord, revision: RevisionRecord): void {
    if (!this.fixture.concurrentEditHooks.has(revision.id) || revision.kind !== "draft") return;
    this.fixture.concurrentEditHooks.delete(revision.id);
    const other = { id: "fixture-other-tab", kind: "human" as const, label: "Local demo editor (another tab)" };
    revision.markdown = revision.markdown.replace(
      "## The Problem\n",
      "## The Problem\n\n_Edited in another tab: tightened the opening claim._\n",
    );
    revision.version += 1;
    revision.updatedAt = nowIso(this.fixture);
    revision.updatedBy = other;
    appendAudit(this.fixture, {
      actor: other,
      action: "revision.saved",
      outcome: "succeeded",
      ideaId: idea.id,
      revisionId: revision.id,
      releaseId: null,
      reason: null,
      detail: `v${revision.number} saved from another tab (simulated)`,
      code: null,
    });
    idea.updatedAt = nowIso(this.fixture);
    touch(this.fixture);
  }

  protected describeSettings(editor: HumanPrincipal): SettingsView {
    return {
      mode: "fixture",
      principal: principalView(this.actor()),
      capability: {
        configured: true,
        verified: false,
        detail:
          "Simulated local-demo capability. No real account is bound; production super-admin binding is WP46-E4.",
      },
      strongAuth: {
        at: editor.strongAuthAt,
        fresh: hasFreshStrongAuth(editor, this.fixture.clock.now()),
        mechanism: "Simulated confirmation (local demo). The real step-up mechanism is chosen in WP46-E4.",
      },
      integrations: [
        {
          id: "auth",
          label: "Super-admin authentication",
          configured: false,
          verified: false,
          available: false,
          detail: "Not built. Needs the editorial WP38 subset (WP46-E4).",
        },
        {
          id: "engine",
          label: "Idea engine submissions",
          configured: false,
          verified: false,
          available: false,
          detail: "Not connected. Needs WP45's frozen record contract (WP46-E5).",
        },
        {
          id: "legacy_import",
          label: "Legacy live-idea import",
          configured: false,
          verified: false,
          available: false,
          detail: "Not run. Demo data only; a read-only import inventory is WP46-E5.",
        },
        {
          id: "release_worker",
          label: "Release worker",
          configured: true,
          verified: false,
          available: true,
          detail: "Simulated in memory. Nothing is deployed.",
        },
        {
          id: "public_site",
          label: "Public site visibility gate",
          configured: false,
          verified: false,
          available: false,
          detail: "Not built. Public pages ignore this workspace (WP46-E6).",
        },
      ],
      policy: {
        version: this.fixture.policyVersion,
        label: this.fixture.env.checks.label,
        requiredChecks: [...this.fixture.env.checks.requiredCheckIds],
      },
      publishing: {
        readiness: "simulated",
        killSwitchEngaged: this.fixture.killSwitchEngaged,
        detail: "Releases in this demo are simulated and never change the public site.",
      },
    };
  }
}
