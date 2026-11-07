// @vitest-environment jsdom
import axe from "axe-core";
import { render, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  EmployeeCard,
  SkippedRoleCard,
  StatusPill,
  STEP_STATUSES,
  WorkspacePageHeader,
  WORKSPACE_HEADING_ID,
} from "@/components/workspace/kit";
import { hydrotrailEmployees } from "@/components/workspace/kit/fixtures";
import { ArtifactReviewCard } from "@/components/workspace/review/ArtifactReviewCard";

afterEach(cleanup);
const AXE = { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] };
const iris = hydrotrailEmployees[0];

describe("WorkspacePageHeader", () => {
  test("one h1 with the id, ember eyebrow with suffix, italic tail, summary and actions", () => {
    const { container } = render(
      <WorkspacePageHeader
        eyebrow="Team HQ"
        eyebrowTone="ember"
        eyebrowSuffix="HydroTrail"
        lead="Your team is"
        tail="getting to work."
        summary="Four things need you."
        actions={<button type="button">Do it</button>}
      />,
    );
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].id).toBe(WORKSPACE_HEADING_ID);
    expect(h1s[0].textContent).toBe("Your team is getting to work.");
    expect(h1s[0].querySelector("em")?.textContent).toBe("getting to work.");
    const eyebrow = container.querySelector("p");
    expect(eyebrow?.textContent).toBe("Team HQ · HydroTrail");
    expect(eyebrow?.className).toContain("text-home-orange-ink");
    expect(eyebrow?.className).toContain("uppercase");
    expect(container.textContent).toContain("Four things need you.");
    expect(container.querySelector("button")?.textContent).toBe("Do it");
  });

  test("the eyebrow is ink by default (most page boards)", () => {
    const { container } = render(<WorkspacePageHeader eyebrow="Email" lead="Four emails" />);
    const eyebrow = container.querySelector("p");
    expect(eyebrow?.className).toContain("text-home-ink-3");
    expect(eyebrow?.className).not.toContain("text-home-orange-ink");
  });

  test("no tail means no em; a custom id is used", () => {
    const out = renderToStaticMarkup(<WorkspacePageHeader eyebrow="Files" lead="What Wren knows" id="files-h" />);
    expect(out).not.toContain("<em");
    expect(out).toContain('id="files-h"');
  });

  test("passes axe", async () => {
    const { container } = render(
      <main aria-labelledby="page-heading">
        <WorkspacePageHeader eyebrow="Email" lead="The four emails" tail="that sell." summary="Read them." />
      </main>,
    );
    const results = await axe.run(container, AXE);
    expect(results.violations).toEqual([]);
  });
});

describe("StatusPill step set and new states", () => {
  const labels = {
    waiting: "Waiting",
    queued: "Queued",
    working: "Working",
    paused: "Paused",
    done: "Done",
    failed: "Failed",
    coming_soon: "Coming soon",
    skipped: "Skipped",
  } as const;

  test.each(STEP_STATUSES)("step %s shows its words", (status) => {
    const out = renderToStaticMarkup(<StatusPill set="step" status={status} />);
    expect(out).toContain(labels[status]);
    expect(out).toContain(`data-status="${status}"`);
  });

  test("employee set shows coming soon (dashed, in words) and failed", () => {
    const soon = renderToStaticMarkup(<StatusPill set="employee" status="coming_soon" />);
    expect(soon).toContain("Coming soon");
    expect(soon).toContain("border-dashed");
    expect(renderToStaticMarkup(<StatusPill set="employee" status="failed" />)).toContain("Failed");
  });

  test("the ember pill uses the token, not a hex value", () => {
    const out = renderToStaticMarkup(<StatusPill set="employee" status="needs_you" />);
    expect(out).toContain("bg-home-ember-soft");
    expect(out).not.toContain("#fbf3e8");
  });
});

describe("EmployeeCard new API", () => {
  test("null workstream shows Coming soon words and autopilot null hides the switch", () => {
    const out = renderToStaticMarkup(<EmployeeCard employee={iris} workstream={null} autopilot={null} />);
    expect(out).toContain("Workstream coming soon");
    expect(out).not.toContain('role="switch"');
    expect(out).not.toContain("Open workstream");
  });

  test("workstream link carries its label and the person's name for screen readers", () => {
    const out = renderToStaticMarkup(
      <EmployeeCard employee={iris} workstream={{ href: "/w", label: "Open Brand" }} autopilot={null} />,
    );
    expect(out).toContain('href="/w"');
    expect(out).toContain("Open Brand");
    expect(out).toContain(" · Iris, Brand");
  });

  test("autopilot object drives the switch", () => {
    const out = renderToStaticMarkup(
      <EmployeeCard employee={iris} workstream={null} autopilot={{ on: true, available: true, onToggle: () => {} }} />,
    );
    expect(out).toContain('aria-checked="true"');
  });

  test("blocker with a free-text label and no detail, and the display states", () => {
    const out = renderToStaticMarkup(
      <EmployeeCard employee={{ ...iris, status: "failed", blocker: { label: "Needs a retry" } }} workstream={null} autopilot={null} />,
    );
    expect(out).toContain("Needs a retry");
    expect(out).not.toContain("Needs a retry</strong> ·");
    expect(out).toContain("Failed");
    expect(out).toContain("border-home-clay-ink/30");
    const soon = renderToStaticMarkup(
      <EmployeeCard employee={{ ...iris, status: "coming_soon" }} workstream={null} autopilot={null} />,
    );
    expect(soon).toContain("border-dashed");
    expect(soon).toContain("Coming soon");
  });

  test("passes axe in a list", async () => {
    const { container } = render(
      <ul>
        <EmployeeCard employee={iris} workstream={null} autopilot={null} />
        <EmployeeCard employee={{ ...hydrotrailEmployees[1], status: "coming_soon" }} workstream={null} autopilot={null} />
      </ul>,
    );
    expect((await axe.run(container, AXE)).violations).toEqual([]);
  });
});

describe("SkippedRoleCard without onHire", () => {
  test("shows the reason and no Hire button", () => {
    const out = renderToStaticMarkup(<SkippedRoleCard role="merch" reason="nothing physical to sell" />);
    expect(out).toContain("nothing physical to sell");
    expect(out).not.toContain("<button");
  });
});

describe("ArtifactReviewCard approveLabel", () => {
  const props = {
    card: { status: "pending" as const, expiresAt: Date.now() + 86_400_000 },
    decide: async () => ({ status: "approved", changed: true }),
    preview: { kind: "failed" as const },
    artifact: { plural: "emails", approvedNote: "Nothing is sent yet." },
  };

  test("defaults to Approve and takes a custom label", () => {
    const first = render(<ArtifactReviewCard {...props} />);
    expect(first.getByRole("button", { name: "Approve" })).toBeTruthy();
    cleanup();
    const second = render(<ArtifactReviewCard {...props} approveLabel="Approve all 4" />);
    expect(second.getByRole("button", { name: "Approve all 4" })).toBeTruthy();
    expect(second.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  test("the change-request textarea border is the 3:1 ink-3 token", async () => {
    const { getByRole, container } = render(
      <ArtifactReviewCard {...props} preview={{ kind: "ready", preview: { outcome: "free", freeRoundsLeft: 2 } }} />,
    );
    getByRole("button", { name: "Ask for changes" }).click();
    const field = await vi.waitFor(() => {
      const el = container.querySelector("textarea");
      if (!el) throw new Error("no textarea");
      return el;
    });
    expect(field.className).toContain("border-home-ink-3");
    expect(field.className).not.toContain("border-home-rule");
  });
});
