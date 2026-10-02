import type { EditorialRepository } from "../../../lib/editorial/contracts/repository";
import type { IngestionCredential } from "../../../lib/editorial/contracts/principal";
import type { EditorialSubmission } from "../../../lib/editorial/contracts/submission";
import type { ArticleSpec } from "../../../lib/editorial/fixtures/spec";

/**
 * What the repository contract suite needs from an adapter under test.
 *
 * The fixture adapter implements it in memory. The live adapter (WP46-E4)
 * implements it against an isolated test deployment with real identities:
 * `customer()` is a signed-in account without the capability, `editor()` the
 * bound super-admin, and the failure/time hooks drive its test worker. A
 * hook the live harness cannot provide must fail loudly, never pass.
 */
export type RepositoryHarness = {
  name: string;
  editor(): EditorialRepository;
  /** A second browser tab of the same editor (same principal, separate client). */
  editorSecondTab(): EditorialRepository;
  anonymous(): EditorialRepository;
  customer(): EditorialRepository;
  releaseWorker(): EditorialRepository;
  ingestion(producer: "engine" | "legacy-import"): { repository: EditorialRepository; credential: IngestionCredential };
  envelope(
    spec: ArticleSpec,
    options: {
      submissionId: string;
      producer?: "engine" | "legacy-import";
      recommendation?: "accept" | "needs_research" | "reject";
      proposedSlug?: string;
    },
  ): Promise<EditorialSubmission>;
  confirmStrongAuth(): void;
  expireStrongAuth(): void;
  setKillSwitch(engaged: boolean): void;
  failNextDeploy(): void;
  loseNextActivationAck(): void;
  runWorker(): Promise<void>;
  advanceTime(ms: number): void;
};

export type HarnessFactory = () => Promise<RepositoryHarness>;
