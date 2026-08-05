import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  DraftMessage,
  IntakeProgress,
  ResumeNotice,
  SaveStatus,
} from "../../components/platform/intake/IntakeFeedback";
import {
  hasMeaningfulDraftInput,
  reconcileDraftState,
  reconcileInitialSave,
  serializeDraftInput,
  type DraftInput,
} from "../../components/platform/intake/draftState";
import { PlatformRouteError } from "../../components/platform/projects/PlatformRouteError";

const blank: DraftInput = {
  title: "",
  problem: "",
  audience: "",
  outcome: "",
  constraints: "",
};

describe("WP25 intake draft state", () => {
  test("the first meaningful entry qualifies for server persistence", () => {
    expect(hasMeaningfulDraftInput(blank)).toBe(false);
    expect(hasMeaningfulDraftInput({ ...blank, title: "C" })).toBe(true);
  });

  test("a clean form hydrates a newer server version", () => {
    const serverInput = { ...blank, title: "Saved in another tab" };
    expect(
      reconcileDraftState({
        localInput: blank,
        lastSavedSerialized: serializeDraftInput(blank),
        localUpdatedAt: 10,
        serverInput,
        serverUpdatedAt: 11,
      }),
    ).toEqual({
      kind: "hydrate",
      input: serverInput,
      updatedAt: 11,
      serialized: serializeDraftInput(serverInput),
    });
  });

  test("a dirty form preserves local text and the stale token on a newer server version", () => {
    const localInput = { ...blank, title: "Unsaved local wording" };
    const reconciliation = reconcileDraftState({
      localInput,
      lastSavedSerialized: serializeDraftInput(blank),
      localUpdatedAt: 10,
      serverInput: { ...blank, title: "Other tab wording" },
      serverUpdatedAt: 11,
    });
    expect(reconciliation).toEqual({ kind: "conflict" });
    expect(localInput.title).toBe("Unsaved local wording");
  });

  test("a losing concurrent first save preserves local text and cannot report Saved", () => {
    const localInput = { ...blank, title: "Second tab wording" };
    const serverInput = { ...blank, title: "First tab wording" };
    const reconciliation = reconcileInitialSave({
      attemptedInput: localInput,
      currentInput: localInput,
      serverInput,
      acceptedInput: false,
    });

    expect(reconciliation).toEqual({
      kind: "conflict",
      serialized: serializeDraftInput(serverInput),
    });
    expect(reconciliation.kind).not.toBe("saved");
    expect(localInput.title).toBe("Second tab wording");
  });

  test("text typed during an accepted first save remains dirty", () => {
    const attemptedInput = { ...blank, title: "Initial wording" };
    const currentInput = { ...blank, title: "Newer local wording" };
    const reconciliation = reconcileInitialSave({
      attemptedInput,
      currentInput,
      serverInput: attemptedInput,
      acceptedInput: true,
    });

    expect(reconciliation).toEqual({
      kind: "dirty",
      serialized: serializeDraftInput(attemptedInput),
    });
    expect(reconciliation.kind).not.toBe("saved");
    expect(currentInput.title).toBe("Newer local wording");
  });
});

describe("WP25 intake accessible states", () => {
  test("progress exposes a non-color current step and responsive structure", () => {
    const shape = renderToStaticMarkup(<IntakeProgress step="shape" />);
    const review = renderToStaticMarkup(<IntakeProgress step="review" />);
    expect(shape).toContain('aria-current="step"');
    expect(shape).toContain("current step");
    expect(shape).toContain("flex-col");
    expect(shape).toContain("sm:flex-row");
    expect(review).toContain("Review and confirm");
    expect(review).toContain("current step");
  });

  test("save, resume, and stale states announce meaningful status", () => {
    const saving = renderToStaticMarkup(<SaveStatus status="saving" />);
    const saved = renderToStaticMarkup(<SaveStatus status="saved" />);
    const resumed = renderToStaticMarkup(<ResumeNotice />);
    const stale = renderToStaticMarkup(
      <DraftMessage message="This draft changed in another tab. Your text is preserved here." />,
    );
    expect(saving).toContain("Saving draft");
    expect(saved).toContain("Draft saved");
    expect(resumed).toContain('role="status"');
    expect(resumed).toContain("server-saved draft");
    expect(stale).toContain('aria-live="polite"');
    expect(stale).toContain("text is preserved");
  });

  test("route errors are generic and offer recovery without exposing an ID", () => {
    const html = renderToStaticMarkup(
      <PlatformRouteError title="Draft unavailable" reset={() => undefined} />,
    );
    expect(html).toContain("Draft unavailable");
    expect(html).toContain("not available to this account");
    expect(html).toContain("Try again");
    expect(html).toContain("/dashboard/projects");
    expect(html).not.toMatch(/project_[A-Za-z0-9]+/);
  });
});
