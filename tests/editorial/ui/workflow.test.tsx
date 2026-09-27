import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/editorial",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
}));

import { StrongAuthStep } from "@/components/admin/editorial/common/StrongAuthStep";
import { SimulatedWorkerTicker } from "@/components/admin/editorial/releases/SimulatedWorkerTicker";
import { DemoControls } from "@/components/admin/editorial/settings/DemoControls";
import { DecisionPanel } from "@/components/admin/editorial/workspace/DecisionPanel";
import { UNPUBLISH_SURFACES } from "@/components/admin/editorial/workspace/LifecycleControls";
import { ReleasePanel } from "@/components/admin/editorial/workspace/ReleasePanel";
import { ApprovalControls, ReviewItemControls } from "@/components/admin/editorial/workspace/ReviewControls";
import { ReviewPanel } from "@/components/admin/editorial/workspace/ReviewPanel";
import { createFixtureEnvironment, type FixtureEnvironment } from "@/lib/editorial/adapters/fixture/environment";
import type { CommandResult } from "@/lib/editorial/contracts/errors";
import type { IdeaDetail, ReviewItemView, RevisionView } from "@/lib/editorial/contracts/views";

const NOW = Date.parse("2026-09-27T12:00:00Z");
let env: FixtureEnvironment;

beforeAll(async () => {
  env = await createFixtureEnvironment({ nowMs: NOW });
});

function unwrap<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

async function load(ideaId: string, revisionId?: string): Promise<{ detail: IdeaDetail; view: RevisionView }> {
  const detail = unwrap(await env.editor().getIdea(ideaId));
  const id = revisionId ?? detail.idea.workingRevision?.id ?? "";
  return { detail, view: unwrap(await env.editor().getRevision(ideaId, id)) };
}

const done = async () => null;
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("decisions", () => {
  test("your decision and the engine's recommendation are shown separately", async () => {
    const { detail } = await load(env.scenarios.newCandidate);
    const markup = html(<DecisionPanel idea={detail.idea} disabledReason={null} onDecide={done} />);
    expect(markup).toContain("Editorial decision");
    expect(markup).toContain("New candidate");
    expect(markup).toMatch(/Engine recommends: <span[^>]*>[^<]+<\/span>\. A recommendation, not an approval\./);
    for (const label of ["Accept…", "Needs research…", "Reject…"]) expect(markup).toContain(label);
    expect(markup).not.toContain("Reopen…");
  });

  test("a rejected idea can be reopened, and a trashed one cannot be decided", async () => {
    const { detail } = await load(env.scenarios.duplicateRejected);
    const markup = html(<DecisionPanel idea={detail.idea} disabledReason="Restore the idea to change the decision." onDecide={done} />);
    expect(markup).toContain("Reopen…");
    expect(markup).not.toContain(">Reject…");
    expect(markup).toContain("Restore the idea to change the decision.");
    expect(markup.match(/<button[^>]*disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("review attestation", () => {
  const item = (status: ReviewItemView["status"]): ReviewItemView => ({
    id: "section:problem",
    kind: "section",
    label: "The Problem",
    target: { kind: "section", id: "problem" },
    dependencyHash: "abc",
    status,
    attestedAt: null,
    note: null,
    flag: null,
  });
  const controls = (status: ReviewItemView["status"]) =>
    html(<ReviewItemControls item={item(status)} disabled={false} onMark={done} onRetract={done} onFlag={done} onNote={done} />);

  test("each item has its own explicit action, labelled with the item", () => {
    expect(controls("unreviewed")).toContain("Mark reviewed<span class=\"sr-only\">: The Problem</span>");
    expect(controls("stale")).toContain("Review again<span class=\"sr-only\">: The Problem</span>");
    expect(controls("reviewed")).toContain("Retract review<span class=\"sr-only\">: The Problem</span>");
    expect(controls("unreviewed")).toContain("Flag…");
    expect(controls("unreviewed")).toContain("Note…");
  });

  test("the checklist has no bulk action and says exactly what remains", async () => {
    const { view } = await load(env.scenarios.acceptedAwaitingReview);
    const markup = html(
      <ReviewPanel
        view={view}
        onGoTo={() => undefined}
        itemActions={(entry) => <ReviewItemControls item={entry} disabled={false} onMark={done} onRetract={done} onFlag={done} onNote={null} />}
      />,
    );
    expect(markup).not.toMatch(/mark (all|everything)|review all|approve all/i);
    const remaining = view.reviewItems.filter((entry) => entry.status !== "reviewed").length;
    expect(markup).toContain(`${remaining} remaining`);
    expect(markup.match(/>Mark reviewed</g)?.length ?? 0).toBe(view.reviewItems.filter((entry) => entry.status === "unreviewed").length);
    expect(markup).toContain('id="approval-blockers"');
  });

  test("approve stays disabled and points at the blocker list until everything is met", async () => {
    const { view } = await load(env.scenarios.acceptedAwaitingReview);
    expect(view.eligibility.canApprove).toBe(false);
    const markup = html(<ApprovalControls view={view} disabledReason={null} onRequestChanges={done} onResume={done} onApprove={done} />);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="approval-blockers"[^>]*>Approve v\d+…<\/button>/);
    expect(markup).toContain("Request changes…");
  });
});

describe("releases", () => {
  const publishing = { strongAuthFresh: false, strongAuthMechanism: "Simulated confirmation (local demo).", killSwitchEngaged: false };

  test("a preview-ready release offers publish only from its own revision; elsewhere it links there", async () => {
    const { detail } = await load(env.scenarios.previewReady);
    const release = detail.releases.find((entry) => entry.state === "preview_ready");
    if (!release?.revisionId) throw new Error("scenario has no preview-ready release");
    const { view } = await load(env.scenarios.previewReady, release.revisionId);
    const panel = (selected: RevisionView) =>
      html(
        <ReleasePanel
          detail={detail}
          view={selected}
          liveMarkdown={null}
          nowMs={NOW}
          publishing={publishing}
          baseHref="/admin/editorial/ideas/x"
          onPrepare={done}
          onPublish={done}
          onCancel={done}
          onRetry={done}
          onReconcile={done}
          onRollback={done}
          onLoadRevision={async () => "unused"}
        />,
      );
    const own = panel(view);
    expect(own).toContain("Local demo: releases are simulated.");
    expect(own).toContain(`Publish v${release.revisionNumber}…`);
    expect(own).toContain("Cancel release…");
    expect(own).toContain("Simulated");
    const elsewhere = panel({ ...view, id: "rev_elsewhere" });
    expect(elsewhere).toContain(`Open v${release.revisionNumber} to publish`);
    expect(elsewhere).not.toContain(`Publish v${release.revisionNumber}…`);
  });

  test("the sign-in confirmation is labelled simulated and never asks for a secret", () => {
    const markup = html(<StrongAuthStep fresh={false} mechanism="Simulated confirmation (local demo)." onConfirmed={() => undefined} />);
    expect(markup).toContain("Confirm it’s me (simulated)");
    expect(markup).toContain("no password or code is asked for");
    expect(markup).not.toMatch(/<input/);
    expect(html(<StrongAuthStep fresh mechanism="x" onConfirmed={() => undefined} />)).toContain("Confirmed within the last 10 minutes.");
  });

  test("unpublish names every affected surface", () => {
    expect(UNPUBLISH_SURFACES).toEqual([
      "the idea page itself",
      "idea lists, category hubs and search",
      "homepage picks and the idea of the week",
      "the sitemap and structured data",
      "public APIs and prompt exports",
    ]);
  });

  test("the simulated worker and the demo controls say what they are", () => {
    const ticker = html(<SimulatedWorkerTicker active />);
    expect(ticker).toContain('aria-label="Simulated release worker"');
    expect(ticker).toContain("Nothing is deployed.");
    expect(html(<SimulatedWorkerTicker active={false} />)).toBe("");
    const demo = html(<DemoControls strongAuthFresh={false} killSwitchEngaged={false} />);
    expect(demo).toContain("Local demo only.");
    for (const label of ["Confirm sign-in (simulated)", "Engage the kill switch", "Make the next deployment fail", "Lose the next activation acknowledgement"]) {
      expect(demo).toContain(label);
    }
  });
});
