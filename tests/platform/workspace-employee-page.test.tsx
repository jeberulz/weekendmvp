// @vitest-environment jsdom
/**
 * WP67 employee pages (`docs/wp/employee-pages/BRIEF.md`) through the real DOM
 * and axe-core: the pure helpers, a working employee (Iris), a coming-soon
 * employee (Sana, SEO), one with no launch steps in the beta (Oli, Outbound),
 * one the roster skipped, a team that is not written yet, loading and error.
 * Every claim on the page comes from a mocked query; nothing is invented.
 */
import axe from "axe-core";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import type { EmployeeActivity } from "@/convex/workspace/employees";
import { EmployeeHeader } from "@/components/workspace/team/employee/EmployeeHeader";
import { EmployeeResponsibilities } from "@/components/workspace/team/employee/EmployeeResponsibilities";
import {
  askLeadPrompt,
  availability,
  deliverableRows,
  employeeHref,
  employeePageState,
  employeeProfile,
  handsOffTo,
  startsWhenCopy,
  trailEntry,
  worksFrom,
} from "@/lib/workspace/employeePage";
import { SPECIALIST_ROLE_KEYS } from "@/lib/workspace/employees";
import { onWrenPrefill } from "@/lib/workspace/wrenPrefill";

const live: { status: unknown; progress: unknown; reviews: unknown; activity: unknown; brandKit: unknown } = {
  status: undefined,
  progress: undefined,
  reviews: [],
  activity: undefined,
  brandKit: { state: "none" },
};

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(ref);
      if (name.includes("employeeActivity")) {
        if (live.activity === "throw") throw new Error("boom");
        return live.activity;
      }
      if (name.includes("launchStatus")) return live.status;
      if (name.includes("launchProgress")) return live.progress;
      if (name.includes("pendingReviews")) return live.reviews;
      if (name.includes("brandKitDraft")) return live.brandKit;
      throw new Error(`unexpected query ${name}`);
    },
  };
});
vi.mock("@/components/platform/client-gates", async () => {
  const actual = await vi.importActual<typeof import("@/components/platform/client-gates")>("@/components/platform/client-gates");
  return {
    WhenConvexReady: ({ children }: { children: ReactNode }) => children,
    QuietErrorBoundary: actual.QuietErrorBoundary,
  };
});

const { EmployeePanel } = await import("@/components/workspace/team/employee/EmployeePanel");

const PROJECT = "project1" as Id<"projects">;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 9, 0);

const role = (roleKey: string, employeeName: string, roleLabel: string, reason = `${roleLabel} reason.`) => ({
  roleKey,
  employeeName,
  roleLabel,
  reason,
});
const READY = {
  state: "ready",
  hired: [
    role("lead", "Wren", "Crew Lead", "Always: runs the team."),
    role("brand", "Iris", "Brand", "Always: designs the logo and sets the voice."),
    role("email", "Elle", "Email"),
    role("social", "Theo", "Social"),
    role("seo", "Sana", "SEO", "Your buyers search before they buy."),
    role("outbound", "Oli", "Outbound", "You sell to a short list of firms."),
  ],
  skipped: [{ roleKey: "ads", roleLabel: "Ads", reason: "No ad budget in your answers." }],
};

const step = (key: string, title: string, employee: string, state: string, extra: Record<string, unknown> = {}) => ({
  key,
  title,
  employee,
  notBuilt: false,
  state,
  ...extra,
});
const PROGRESS = {
  started: true,
  retryable: false,
  steps: [
    step("blueprint", "Blueprint", "lead", "succeeded"),
    step("roster", "Your team", "lead", "succeeded"),
    step("brand_kit", "Brand kit", "brand", "succeeded"),
    step("logo_marks", "Logo marks", "brand", "skipped", { notBuilt: true, reason: "Logo marks is not built yet." }),
    step("email_sequence", "Email sequence", "email", "running"),
    step("social_pack", "Social pack", "social", "queued"),
    step("seo_pack", "SEO pack", "seo", "skipped", { notBuilt: true, reason: "SEO pack is coming in a later update." }),
  ],
};

const task = (extra: Partial<EmployeeActivity["tasks"][number]> = {}): EmployeeActivity["tasks"][number] => ({
  title: "Brand kit",
  status: "succeeded",
  changeRound: 0n,
  revision: false,
  createdAt: T0,
  updatedAt: T0 + 60_000,
  attempts: 1,
  failedAttempts: 0,
  creditCost: 0n,
  charged: 0n,
  refunded: 0n,
  drafts: [{ kind: "brand_kit", title: "Brand kit", createdAt: T0 + 60_000 }],
  decisions: [],
  ...extra,
});

const IRIS: EmployeeActivity = {
  member: { status: "done", hiredBy: "rule", hiredAt: T0 - DAY },
  tasks: [
    task({
      title: "Brand kit, change round 1",
      revision: true,
      changeRound: 1n,
      createdAt: T0 + DAY,
      updatedAt: T0 + DAY + 60_000,
      decisions: [{ status: "pending", changeRound: 1n, createdAt: T0 + DAY + 60_000 }],
    }),
    task({
      attempts: 2,
      failedAttempts: 1,
      decisions: [{ status: "changes_requested", changeRound: 0n, note: "Warmer colours, please.", createdAt: T0, decidedAt: T0 + 3_600_000 }],
    }),
  ],
  tasksTruncated: false,
  deliverables: [
    { kind: "brand_kit", title: "Brand kit, change round 1", createdAt: T0 + DAY + 60_000, review: { status: "pending", changeRound: 1n, createdAt: T0 + DAY + 60_000 } },
    { kind: "brand_kit", title: "Brand kit", createdAt: T0 + 60_000, review: { status: "changes_requested", changeRound: 0n, note: "Warmer colours, please.", createdAt: T0, decidedAt: T0 + 3_600_000 } },
  ],
  deliverablesTruncated: false,
};

const EMPTY: EmployeeActivity = {
  member: { status: "queued", hiredBy: "rule", hiredAt: T0 - DAY },
  tasks: [],
  tasksTruncated: false,
  deliverables: [],
  deliverablesTruncated: false,
};

const REVIEW = {
  approvalId: "approval1",
  kind: "brand_kit",
  title: "Brand kit, change round 1",
  changeRound: 1n,
  expiresAt: Date.now() + 2 * DAY + 1000,
  href: "/dashboard/b/project1/brand",
};

function show(
  roleKey: "brand" | "seo" | "outbound" | "ads",
  options: { status?: unknown; progress?: unknown; reviews?: unknown; activity?: unknown; brandKit?: unknown } = {},
) {
  live.status = "status" in options ? options.status : READY;
  live.progress = "progress" in options ? options.progress : PROGRESS;
  live.reviews = "reviews" in options ? options.reviews : [];
  live.activity = "activity" in options ? options.activity : EMPTY;
  live.brandKit = "brandKit" in options ? options.brandKit : { state: "none" };
  const profile = employeeProfile(roleKey);
  return render(
    <main>
      <EmployeeHeader projectId={PROJECT} businessName="HydroTrail" lead="Wren" profile={profile} />
      <EmployeePanel
        projectId={PROJECT}
        role={roleKey}
        businessName="HydroTrail"
        lead="Wren"
        job={<EmployeeResponsibilities profile={profile} lead="Wren" />}
      />
    </main>,
  );
}

async function noAxe(container: Element) {
  const results = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
  expect(results.violations.map((v) => v.id)).toEqual([]);
}

const headings = (level: number) => screen.queryAllByRole("heading", { level }).map((h) => h.textContent ?? "");

afterEach(() => {
  cleanup();
  live.status = undefined;
  live.progress = undefined;
  live.reviews = [];
  live.activity = undefined;
  live.brandKit = { state: "none" };
});

describe("helpers", () => {
  test("every specialist has a page; the Crew Lead and unknown keys have none", () => {
    for (const key of SPECIALIST_ROLE_KEYS) expect(employeeHref("p1", key)).toBe(`/dashboard/b/p1/team/${key}`);
    expect(employeeHref("p1", "lead")).toBeNull();
    expect(employeeHref("p1", "ceo")).toBeNull();
  });

  test("availability follows the launch DAG's built steps", () => {
    expect(availability("brand")).toEqual({ kind: "available", later: ["Logo marks"] });
    expect(availability("email")).toEqual({ kind: "available", later: [] });
    expect(availability("seo").kind).toBe("coming_soon");
    expect(availability("landing").kind).toBe("coming_soon");
    for (const key of ["curriculum", "community", "merch", "outbound"] as const) expect(availability(key).kind).toBe("not_in_beta");
    expect(startsWhenCopy("Sana", availability("seo"))).toBe("Sana starts when the seo pack ships in a later update. Until then there is no work to show.");
    expect(startsWhenCopy("Oli", availability("outbound"))).toMatch(/not part of this beta yet/);
  });

  test("the page state comes from the roster: hired, skipped with its reason, or not written yet", () => {
    const hired = [{ role: "brand" as const, name: "Iris", roleLabel: "Brand", reason: "Always." }];
    const skipped = [{ role: "ads" as const, roleLabel: "Ads", reason: "No ad budget." }];
    const ready = { state: "ready", hired: [], skipped: [] } as unknown as Parameters<typeof employeePageState>[1];
    expect(employeePageState("brand", ready, hired, skipped)).toEqual({ kind: "hired", reason: "Always." });
    expect(employeePageState("ads", ready, hired, skipped)).toEqual({ kind: "not_hired", reason: "No ad budget." });
    expect(employeePageState("brand", { state: "assembling" } as Parameters<typeof employeePageState>[1], hired, skipped).kind).toBe("team_pending");
  });

  test("hand-offs name only hired people; inputs credit the employee who drafts them", () => {
    const team = [
      { role: "brand" as const, name: "Iris" },
      { role: "email" as const, name: "Elle" },
    ];
    const after = handsOffTo("brand", team);
    expect(after.map((entry) => entry.name)).toContain("Elle");
    expect(after.every((entry) => team.some((member) => member.name === entry.name))).toBe(true);
    // Leo's landing page is not built: hired or not, it never "starts" here.
    expect(handsOffTo("brand", [...team, { role: "landing" as const, name: "Leo" }]).map((entry) => entry.name)).not.toContain("Leo");
    expect(worksFrom("email", team, "Wren").join(" ")).toMatch(/Iris/);
  });

  test("the trail says what happened, in words, with no invented detail", () => {
    const entry = trailEntry(IRIS.tasks[1], 0);
    expect(entry.headline).toBe("Drafted the Brand kit");
    expect(entry.outcome).toBe("Finished");
    expect(entry.details).toEqual(["Took 2 tries (1 failed try retried automatically).", "You asked for changes: “Warmer colours, please.”"]);
    const revised = trailEntry(IRIS.tasks[0], 1);
    expect(revised.headline).toBe("Revised the Brand kit (change round 1)");
    expect(revised.details).toEqual(["Waiting on your review."]);
    expect(trailEntry(task({ status: "failed" }), 2).details).toEqual(["Nothing was charged."]);
    expect(trailEntry(task({ creditCost: 3n, charged: 3n, refunded: 3n, status: "failed" }), 3).details).toEqual(["3 credits charged, then refunded."]);
  });

  test("deliverables mark the latest draft per kind", () => {
    const rows = deliverableRows(IRIS.deliverables);
    expect(rows.map((row) => row.label)).toEqual(["Latest draft", "Earlier draft"]);
    expect(rows.map((row) => row.reviewTone)).toEqual(["ready", "changes_requested"]);
  });

  test("every profile says the specialist never messages the founder directly", () => {
    for (const key of SPECIALIST_ROLE_KEYS) {
      const profile = employeeProfile(key);
      expect(profile.wontDo[0]).toMatch(/Message you directly/);
      expect(profile.responsibilities.length).toBeGreaterThan(0);
    }
  });
});

describe("a working employee (Iris, Brand)", () => {
  test("profile, status, waiting on you, now and next, deliverables, trail, the job and the voice; no axe violations", async () => {
    const { container } = show("brand", { activity: IRIS, reviews: [REVIEW] });
    expect(headings(1)).toEqual(["Iris · Brand"]);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Team HQ" }).getAttribute("href")).toBe("/dashboard/b/project1/team");

    const status = screen.getByRole("region", { name: "Iris's status" });
    expect(status.textContent).toContain("Why Wren hired Iris: Always: designs the logo and sets the voice.");
    expect(status.textContent).toContain("2 drafts · 1 waiting on you · 0 approved");

    const waiting = screen.getByRole("region", { name: /Waiting on you/ });
    expect(within(waiting).getByRole("link", { name: "Review Brand kit, change round 1" }).getAttribute("href")).toBe("/dashboard/b/project1/brand");

    const now = screen.getByRole("region", { name: /Now and next/ });
    expect(within(now).getByRole("list", { name: "Iris's launch steps" }).textContent).toContain("Brand kit");
    expect(now.textContent).toContain("Logo marks comes in a later update.");
    expect(now.textContent).toContain("Then these start");
    expect(now.textContent).toContain("Elle");

    const drafts = screen.getByRole("region", { name: /Deliverables/ });
    expect(within(drafts).getAllByRole("listitem")).toHaveLength(2);
    expect(drafts.textContent).toContain("Latest draft");

    const trail = screen.getByRole("list", { name: "Iris's jobs, newest first" });
    const items = within(trail).getAllByRole("listitem");
    expect(items[0].textContent).toContain("Revised the Brand kit (change round 1)");
    expect(items[1].textContent).toContain("You asked for changes: “Warmer colours, please.”");
    expect(items[0].querySelector("time")?.getAttribute("dateTime")).toBe(new Date(T0 + DAY).toISOString());

    expect(screen.getByRole("region", { name: /The job, in full/ }).textContent).toContain("What Iris won't do");
    expect(screen.getByRole("region", { name: /The voice/ })).toBeTruthy();
    await noAxe(container);
  });

  test("Ask Wren puts a question in the chat composer and says so politely", async () => {
    const user = userEvent.setup();
    const received: string[] = [];
    const stop = onWrenPrefill((text) => received.push(text));
    show("brand", { activity: IRIS });
    await user.click(screen.getByRole("button", { name: "Ask Wren about Iris" }));
    stop();
    expect(received).toEqual([askLeadPrompt("Iris", "Brand")]);
    expect(screen.getByRole("status").textContent).toContain("Your question is in the chat with Wren.");
  });

  test("an employee with no work yet says so in words", async () => {
    const { container } = show("brand", { activity: EMPTY });
    expect(screen.getByText("Iris hasn't written a draft for this business yet.")).toBeTruthy();
    expect(screen.getByText("No jobs yet. Iris's work shows here as it starts.")).toBeTruthy();
    await noAxe(container);
  });
});

describe("a coming-soon employee (Sana, SEO)", () => {
  test("profile and when they start; no trail, no deliverables, no fake numbers", async () => {
    const { container } = show("seo");
    expect(headings(1)).toEqual(["Sana · SEO"]);
    const status = screen.getByRole("region", { name: "Sana's status" });
    expect(status.textContent).toContain("Sana starts when the seo pack ships in a later update.");
    expect(status.textContent).not.toMatch(/drafts ·/);
    expect(screen.queryByRole("region", { name: /Deliverables/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /Activity/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /Waiting on you/ })).toBeNull();
    expect(screen.getByRole("region", { name: /Now and next/ }).textContent).toContain("SEO pack");
    expect(screen.getByRole("region", { name: /The job, in full/ })).toBeTruthy();
    await noAxe(container);
  });

  test("a hired role with no launch step in the beta says it is not part of the beta yet", async () => {
    const { container } = show("outbound");
    expect(screen.getByRole("region", { name: "Oli's status" }).textContent).toMatch(/not part of this beta yet/);
    expect(screen.queryByRole("region", { name: /Now and next/ })).toBeNull();
    await noAxe(container);
  });
});

describe("a not-hired employee (Ada, Ads)", () => {
  test("says why the roster left them off, and offers no work sections", async () => {
    const { container } = show("ads");
    const skipped = screen.getByRole("region", { name: "Not on HydroTrail's team" });
    expect(skipped.textContent).toContain("Skipped · No ad budget in your answers.");
    expect(screen.queryByRole("region", { name: /status/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /Activity/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Ask Wren about Ada" })).toBeTruthy();
    await noAxe(container);
  });
});

describe("states", () => {
  test("team not written yet: one plain line and a way back", async () => {
    const { container } = show("brand", { status: { state: "assembling" } });
    expect(screen.getByRole("region", { name: "Iris's status" }).textContent).toContain("Wren is putting your team together.");
    expect(screen.getByRole("link", { name: "Open Team HQ" })).toBeTruthy();
    await noAxe(container);
  });

  test("loading keeps the h1 and the server-rendered job", () => {
    show("brand", { status: undefined, activity: undefined });
    expect(headings(1)).toEqual(["Iris · Brand"]);
    expect(screen.getAllByText("Loading Iris's work…").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: /The job, in full/ })).toBeTruthy();
  });

  test("a failing query shows a plain message and keeps the job", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    show("brand", { activity: "throw" });
    spy.mockRestore();
    expect(screen.getByRole("region", { name: /The job, in full/ })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Iris's status" })).toBeNull();
  });
});
