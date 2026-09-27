import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/editorial/ideas/x",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
}));

import { ComparePane } from "@/components/admin/editorial/workspace/ComparePane";
import { ConflictPanel } from "@/components/admin/editorial/workspace/ConflictPanel";
import { IdeaWorkspace, type IdeaWorkspaceProps } from "@/components/admin/editorial/workspace/IdeaWorkspace";
import { describeSaveState } from "@/components/admin/editorial/workspace/SaveStatus";
import { createFixtureEnvironment, type FixtureEnvironment } from "@/lib/editorial/adapters/fixture/environment";
import type { CommandResult, DraftConflict } from "@/lib/editorial/contracts/errors";
import type { SaveControllerState, SaveStatus } from "@/lib/editorial/editor/save-controller";
import type { WorkspaceTab } from "@/lib/editorial/presentation/filters";

const NOW = Date.parse("2026-09-27T12:00:00Z");
let env: FixtureEnvironment;

beforeAll(async () => {
  env = await createFixtureEnvironment({ nowMs: NOW });
});

function unwrap<T>(result: CommandResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

async function props(ideaId: string, options: { revisionId?: string; tab?: WorkspaceTab } = {}): Promise<IdeaWorkspaceProps> {
  const repository = env.editor();
  const detail = unwrap(await repository.getIdea(ideaId));
  const revisionId = options.revisionId ?? detail.idea.workingRevision?.id ?? detail.idea.liveRevision?.id;
  if (!revisionId) throw new Error("no revision");
  const revision = unwrap(await repository.getRevision(ideaId, revisionId));
  return {
    detail,
    revision,
    compareTargets: [],
    nowMs: NOW,
    initialTab: options.tab ?? "write",
    initialInspector: "evidence",
    notice: null,
    baseHref: `/admin/editorial/ideas/${ideaId}`,
  };
}

const render = (p: IdeaWorkspaceProps) => renderToStaticMarkup(<IdeaWorkspace {...p} />);

describe("idea workspace", () => {
  test("the title bar always shows the live revision, the selected revision, origin, save state and review state", async () => {
    const markup = render(await props(env.scenarios.flagshipLiveWithDraft));
    expect(markup).toContain("Live v2");
    expect(markup).toContain("Editing v3");
    expect(markup).toContain("Engine draft");
    expect(markup).toContain("Review: Draft");
    expect(markup).toMatch(/Saved \d\d:\d\d UTC/);
    expect(markup).toContain(">Save</button>");
    expect(markup).toContain("More actions");
  });

  test("main and inspector tabs, one outline for the eight sections, and a labelled Markdown editor", async () => {
    const markup = render(await props(env.scenarios.flagshipLiveWithDraft));
    expect(markup).toContain('aria-label="Article views"');
    expect(markup).toContain('aria-label="Inspector"');
    for (const tab of ["Write", "Preview", "Compare", "History", "Evidence", "Quality", "Review", "Details"]) {
      expect(markup).toMatch(new RegExp(`role="tab"[^>]*>${tab}`));
    }
    expect(markup).toContain('aria-label="Article sections"');
    expect(markup.match(/ — go to section/g)?.length ?? 0).toBe(8);
    expect(markup).toMatch(/<label[^>]*for="editor-body"[^>]*>Article \(Markdown\)<\/label>/);
    expect(markup).toContain('aria-describedby="editor-body-help editor-counts"');
    expect(markup).toContain("Measured from the text above (not a quality score)");
    // The review footer counts real items; there is no aggregate quality score.
    expect(markup).toMatch(/sections reviewed/);
    expect(markup).not.toMatch(/quality score:?\s*\d/i);
  });

  test("the preview is labelled as unverified and marks claims with labelled buttons", async () => {
    const markup = render(await props(env.scenarios.flagshipLiveWithDraft, { tab: "preview" }));
    expect(markup).toContain("Editorial preview — public rendering not yet verified.");
    expect(markup).toContain("data-claim-button=");
    expect(markup).toContain("Show evidence for claim:");
    expect(markup).toContain('aria-label="Preview width"');
  });

  test("a quarantined legacy page is read-only, says why, and shows its raw markup as text", async () => {
    const markup = render(await props(env.scenarios.legacyQuarantined, { tab: "preview" }));
    expect(markup).toContain("Quarantined:");
    expect(markup).toContain("Read-only");
    expect(markup).toContain("Edit in a new revision");
    expect(markup).toContain("Live before this workspace existed");
    expect(markup).toContain("&lt;Callout");
    expect(markup).not.toMatch(/<callout/i);
    expect(markup).not.toContain(">Save</button>");
  });

  test("an older revision opens read-only and points to the working draft", async () => {
    const flagship = unwrap(await env.editor().getIdea(env.scenarios.flagshipLiveWithDraft));
    const live = flagship.idea.liveRevision;
    expect(live).not.toBeNull();
    const markup = render(await props(env.scenarios.flagshipLiveWithDraft, { revisionId: live?.id }));
    expect(markup).toContain("Viewing v2");
    expect(markup).toContain("Open working draft v3");
    expect(markup).toContain("Read-only");
  });
});

describe("save states are distinct and honest", () => {
  const base: SaveControllerState = {
    status: "saved",
    baseVersion: 3,
    saved: { title: "t", markdown: "m", metadata: {} as SaveControllerState["saved"]["metadata"] },
    current: { title: "t", markdown: "m", metadata: {} as SaveControllerState["saved"]["metadata"] },
    lastSavedAt: "2026-09-27T12:42:00Z",
    conflict: null,
    error: { code: "PRECONDITION_FAILED", message: "Restore the idea before editing." },
    readOnlyReason: null,
    attempts: 0,
  };
  const text = (status: SaveStatus, metadataInvalid = false) => describeSaveState({ ...base, status }, metadataInvalid).text;

  test("each status has its own message", () => {
    expect(text("saved")).toBe("Saved 12:42 UTC");
    expect(text("dirty")).toBe("Unsaved changes");
    expect(text("saving")).toBe("Saving…");
    expect(text("offline")).toBe("Offline — changes not saved");
    expect(text("error")).toBe("Save failed — Restore the idea before editing.");
    expect(text("conflict")).toBe("Conflict — review newer revision");
    expect(text("read_only")).toBe("Read-only");
    const all = (["saved", "dirty", "saving", "offline", "error", "conflict", "read_only"] as const).map((status) => text(status));
    expect(new Set(all).size).toBe(all.length);
  });

  test("invalid metadata is never reported as saved", () => {
    expect(text("saved", true)).toBe("Metadata has errors — not saved");
  });

  test("offline and failed saves offer a retry; conflicts point to the conflict panel", () => {
    expect(describeSaveState({ ...base, status: "offline" }, false).action).toBe("retry");
    expect(describeSaveState({ ...base, status: "error" }, false).action).toBe("retry");
    expect(describeSaveState({ ...base, status: "conflict" }, false).action).toBe("conflict");
    expect(describeSaveState({ ...base, status: "saved" }, false).action).toBeNull();
  });
});

describe("conflict and compare", () => {
  const conflict: DraftConflict = {
    revisionId: "rev_1",
    latestVersion: 7,
    savedAt: "2026-09-27T09:03:00Z",
    savedBy: "Another tab",
    title: "Theirs",
    markdown: "## The Problem\nTheirs.",
    frozen: false,
  };
  const noop = () => undefined;
  const panel = (value: DraftConflict) =>
    renderToStaticMarkup(
      <ConflictPanel
        conflict={value}
        busy={false}
        error={null}
        onCompare={noop}
        onKeepMine={noop}
        onUseTheirs={noop}
        onForkWithMine={noop}
        onDiscardMine={noop}
      />,
    );

  test("a newer save offers compare, keep mine and use theirs, and says the text is unsaved", () => {
    const markup = panel(conflict);
    expect(markup).toContain("A newer version was saved elsewhere");
    expect(markup).toContain("Your text is still here and has not been saved.");
    for (const label of ["Compare with the newer copy", "Keep mine", "Use theirs"]) expect(markup).toContain(label);
    expect(markup).not.toContain("Save my text as a new revision");
  });

  test("a frozen draft cannot take 'keep mine'; the text can be carried into a new revision", () => {
    const markup = panel({ ...conflict, frozen: true });
    expect(markup).toContain("This draft can no longer be edited");
    expect(markup).toContain("Save my text as a new revision");
    expect(markup).toContain("Discard my text and reload");
    expect(markup).not.toContain("Keep mine");
  });

  test("compare reports a title-only change without an empty line diff", () => {
    const markup = renderToStaticMarkup(
      <ComparePane
        targets={[{ key: "theirs", label: "Newer saved copy", title: "Theirs", markdown: "## The Problem\nSame." }]}
        current={{ title: "Mine", markdown: "## The Problem\nSame." }}
        currentLabel="this draft"
        initialKey="theirs"
      />,
    );
    expect(markup).toContain("The article body is identical; only the title differs.");
    expect(markup).not.toContain("Line changes from");
  });

  test("compare lists added and removed lines with screen-reader labels", () => {
    const markup = renderToStaticMarkup(
      <ComparePane
        targets={[{ key: "live", label: "Live v2", title: "T", markdown: "## The Problem\nOld line." }]}
        current={{ title: "T", markdown: "## The Problem\nNew line." }}
        currentLabel="this draft"
        initialKey={null}
      />,
    );
    expect(markup).toContain("Changed sections: The Problem");
    expect(markup).toContain("Removed, line 2: ");
    expect(markup).toContain("Added, line 2: ");
  });
});
