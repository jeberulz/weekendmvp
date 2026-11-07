/**
 * Team HQ pure rules: per-employee status (every rule, including coming soon
 * versus queued), the header counts and copy, filters, workstream links, the
 * plan grouping and the "Why this team?" rows.
 */
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";

import type { LaunchView } from "@/lib/workspace/crew/launch";
import {
  applyFilter,
  employeeStatus,
  employeeStatuses,
  filterEmptyCopy,
  filterStatusLine,
  headCounts,
  launchErrorMessage,
  leadName,
  planGroups,
  planSummary,
  readyRoster,
  stepPillStatus,
  teamHeaderCopy,
  teamStageAnnouncement,
  visibleFilters,
  whyRows,
  workstreamFor,
  type TeamReview,
  type TeamStep,
} from "@/lib/workspace/teamHq";

const step = (key: string, employee: TeamStep["employee"], state: TeamStep["state"], extra: Partial<TeamStep> = {}): TeamStep => ({
  key,
  title: key === "brand_kit" ? "Brand kit" : key === "email_sequence" ? "Email sequence" : key,
  employee,
  notBuilt: false,
  state,
  ...extra,
});
const review = (kind: TeamReview["kind"], extra: Partial<TeamReview> = {}): TeamReview => ({
  kind,
  title: kind === "brand_kit" ? "Brand kit" : "Blueprint",
  changeRound: 0n,
  ...extra,
});
const IRIS = { role: "brand" as const, name: "Iris" };

describe("employeeStatus rules", () => {
  test("1: a pending review it owns means needs_you, with the change round", () => {
    expect(employeeStatus(IRIS, [step("brand_kit", "brand", "running")], [review("brand_kit")])).toMatchObject({
      status: "needs_you",
      detail: "Brand kit ready for your OK",
    });
    expect(employeeStatus(IRIS, [], [review("brand_kit", { changeRound: 2n })]).detail).toBe(
      "Brand kit · change round 2 ready for your OK",
    );
    expect(employeeStatus(IRIS, [], [review("brand_kit"), review("brand_kit")]).detail).toBe("Brand kit ready for your OK (+1 more)");
  });

  test("a review owned by someone else does not move this role", () => {
    expect(employeeStatus(IRIS, [step("brand_kit", "brand", "succeeded")], [review("blueprint")]).status).toBe("done");
  });

  test("2: a failed step is failed, before paused or running; the detail is the reason", () => {
    const steps = [step("brand_kit", "brand", "failed", { reason: "This step did not finish." }), step("logo", "brand", "running")];
    expect(employeeStatus(IRIS, steps, [])).toMatchObject({ status: "failed", detail: "This step did not finish." });
  });

  test("3: a paused step is needs_you with its reason", () => {
    expect(employeeStatus(IRIS, [step("brand_kit", "brand", "paused", { reason: "Paused: budget." })], [])).toMatchObject({
      status: "needs_you",
      detail: "Paused: budget.",
    });
  });

  test("4: a running step is working: Writing the brand kit", () => {
    expect(employeeStatus(IRIS, [step("brand_kit", "brand", "running")], [])).toMatchObject({
      status: "working",
      detail: "Writing the brand kit",
    });
  });

  test("5: a queued step (waiting for a free slot) is working", () => {
    expect(employeeStatus(IRIS, [step("brand_kit", "brand", "queued")], [])).toMatchObject({
      status: "working",
      detail: "Waiting for a free slot",
    });
  });

  test("6: a waiting step is queued, with the reason as the blocker", () => {
    expect(employeeStatus(IRIS, [step("brand_kit", "brand", "waiting", { reason: "Waiting on the team." })], [])).toMatchObject({
      status: "queued",
      blocker: { label: "Waiting on the team." },
    });
  });

  test("7: every built step done is done, naming the work", () => {
    const elle = { role: "email" as const, name: "Elle" };
    expect(employeeStatus(elle, [step("email_sequence", "email", "succeeded")], [])).toMatchObject({
      status: "done",
      detail: "Email sequence done",
    });
  });

  test("8: a role whose steps are all unbuilt reads Coming soon, never Queued", () => {
    const steps = [
      step("seo_pack", "seo", "skipped", { notBuilt: true, reason: "SEO pack is coming in a later update, so nothing was written for it yet." }),
    ];
    const seo = employeeStatus({ role: "seo", name: "Sana" }, steps, []);
    expect(seo.status).toBe("coming_soon");
    expect(seo.detail).toMatch(/coming in a later update/);
    // Even if the data says "waiting" on an unbuilt step, it is not a queued role.
    const waitingUnbuilt = [step("landing_spec", "landing", "waiting", { notBuilt: true, reason: "Waiting on the logo marks." })];
    expect(employeeStatus({ role: "landing", name: "Leo" }, waitingUnbuilt, []).status).toBe("coming_soon");
  });

  test("8: a role that owns no step is coming soon with an honest line", () => {
    expect(employeeStatus({ role: "curriculum", name: "Cora" }, [], [])).toEqual({
      role: "curriculum",
      name: "Cora",
      status: "coming_soon",
      detail: "Nothing to do in this beta yet.",
    });
  });

  test("a half-built role reads from its built steps: brand kit done, logo marks coming later", () => {
    const steps = [step("brand_kit", "brand", "succeeded"), step("logo_marks", "brand", "skipped", { notBuilt: true, reason: "not built" })];
    expect(employeeStatus(IRIS, steps, [])).toMatchObject({ status: "done", detail: "Brand kit done" });
  });

  test("a role whose steps the roster skipped is coming soon, not done", () => {
    const steps = [step("brand_kit", "brand", "skipped", { reason: "Needs the team, which this team skips." })];
    expect(employeeStatus(IRIS, steps, [])).toMatchObject({ status: "coming_soon", detail: "Needs the team, which this team skips." });
  });

  test("employeeStatuses keeps roster order", () => {
    const out = employeeStatuses([IRIS, { role: "email", name: "Elle" }], [], []);
    expect(out.map((entry) => entry.role)).toEqual(["brand", "email"]);
  });
});

describe("counts, filters and header", () => {
  const entries = [
    { role: "lead" as const, name: "Wren", status: "needs_you" as const, detail: "" },
    { role: "brand" as const, name: "Iris", status: "done" as const, detail: "" },
    { role: "email" as const, name: "Elle", status: "working" as const, detail: "" },
    { role: "seo" as const, name: "Sana", status: "coming_soon" as const, detail: "" },
    { role: "ads" as const, name: "Ada", status: "coming_soon" as const, detail: "" },
  ];

  test("headCounts", () => {
    expect(headCounts(entries)).toEqual({ all: 5, needs_you: 1, done: 1, working: 1, coming_soon: 2, queued: 0, failed: 0 });
  });

  test("filters show Failed and Coming soon only when something is in them", () => {
    expect(visibleFilters(headCounts([]))).toEqual(["all", "needs_you", "working", "queued", "done"]);
    expect(visibleFilters(headCounts(entries))).toEqual(["all", "needs_you", "working", "queued", "done", "coming_soon"]);
    expect(visibleFilters(headCounts([{ status: "failed" }]))).toContain("failed");
  });

  test("applyFilter and the status line", () => {
    expect(applyFilter(entries, "coming_soon")).toHaveLength(2);
    expect(applyFilter(entries, "all")).toHaveLength(5);
    expect(filterStatusLine(2, 4, "coming_soon")).toBe("Showing 2 of 4 specialists. Filter: Coming soon.");
    expect(filterStatusLine(1, 1, "all")).toBe("Showing 1 of 1 specialist.");
    expect(filterEmptyCopy("needs_you", "Wren")).toBe("Nobody needs you right now. Wren will bring the next decision here.");
    expect(filterEmptyCopy("done", "Wren")).toBe("No one is done right now.");
  });

  const ready: LaunchView = { state: "ready", hired: [], skipped: [] };

  test("ready header: counts come from the statuses, and zero says so honestly", () => {
    const copy = teamHeaderCopy({ launch: ready, lead: "Wren", statuses: entries, reviewCount: 2 });
    expect(copy.lead).toBe("5 on the team.");
    expect(copy.tail).toBe("1 needs you.");
    expect(copy.summary).toBe(
      "Wren is routing 2 reviews. Of 4 specialists: 0 need you, 1 working, 1 done, 2 coming soon. Nothing sends, posts or spends without your OK.",
    );
    expect(copy.showWhy).toBe(true);
  });

  test("ready header with nobody needing you never says '0 need you' as the tail", () => {
    const calm = entries.map((entry) => (entry.status === "needs_you" ? { ...entry, status: "done" as const } : entry));
    const copy = teamHeaderCopy({ launch: ready, lead: "Wren", statuses: calm, reviewCount: 0 });
    expect(copy.tail).toBe("Nobody needs you right now.");
    expect(copy.summary.startsWith("Wren has no reviews waiting.")).toBe(true);
    const two = entries.map((entry) => ({ ...entry, status: "needs_you" as const }));
    expect(teamHeaderCopy({ launch: ready, lead: "Wren", statuses: two, reviewCount: 1 }).tail).toBe("5 need you.");
    expect(teamHeaderCopy({ launch: ready, lead: "Wren", statuses: entries, reviewCount: 1 }).summary).toContain("routing 1 review.");
  });

  test("not started, assembling and failed headers", () => {
    expect(teamHeaderCopy({ launch: { state: "not_started" }, lead: "Your co-founder", statuses: [], reviewCount: 0 })).toEqual({
      lead: "Team HQ",
      summary: "Your launch hasn't started, so there is no team yet.",
      showWhy: false,
    });
    const assembling = teamHeaderCopy({ launch: { state: "assembling" }, lead: "Wren", statuses: [], reviewCount: 0 });
    expect(assembling).toMatchObject({ lead: "Team HQ.", tail: "Your team is on its way.", showWhy: false });
    expect(assembling.summary).toBe("Wren is putting your team together. This takes about a minute.");
    const failed = teamHeaderCopy({ launch: { state: "failed", paused: false, retryable: true }, lead: "Wren", statuses: [], reviewCount: 0 });
    expect(failed.lead).toBe("Team HQ");
    expect(failed.summary).toMatch(/Try again/);
    expect(
      teamHeaderCopy({ launch: { state: "failed", paused: false, retryable: false }, lead: "Wren", statuses: [], reviewCount: 0 }).summary,
    ).not.toMatch(/Try again/);
  });
});

describe("lead, roster, announcements, errors", () => {
  const launch: LaunchView = {
    state: "ready",
    hired: [
      { roleKey: "lead", employeeName: "Wren", roleLabel: "Crew Lead", reason: "Always." },
      { roleKey: "brand", employeeName: "Iris", roleLabel: "Brand", reason: "Always." },
    ],
    skipped: [{ roleKey: "outbound", roleLabel: "Outbound", reason: "Nobody to email." }],
  };

  test("leadName is the lead's employee name, else the honest fallback", () => {
    expect(leadName(launch)).toBe("Wren");
    expect(leadName({ state: "assembling" })).toBe("Your co-founder");
    expect(leadName(undefined)).toBe("Your co-founder");
  });

  test("readyRoster narrows keys", () => {
    if (launch.state !== "ready") throw new Error("fixture");
    const roster = readyRoster(launch);
    expect(roster.hired.map((entry) => entry.role)).toEqual(["lead", "brand"]);
    expect(roster.skipped).toEqual([{ role: "outbound", roleLabel: "Outbound", reason: "Nobody to email." }]);
  });

  test("team announcements", () => {
    expect(teamStageAnnouncement({ state: "assembling" }, "Wren")).toBe("Wren is putting your team together.");
    expect(teamStageAnnouncement({ state: "failed", paused: true, retryable: true }, "Wren")).toBe(
      "Wren paused putting your team together. You can try again.",
    );
    expect(teamStageAnnouncement({ state: "failed", paused: false, retryable: false }, "Wren")).toMatch(/for this business/);
    expect(teamStageAnnouncement(launch, "Wren")).toBe("Your team is ready: 2 hired, 1 skipped for now.");
    expect(teamStageAnnouncement({ state: "not_started" }, "Wren")).toBe("");
  });

  test("launchErrorMessage is plain words, never the raw error", () => {
    expect(launchErrorMessage(new ConvexError({ kind: "RateLimited" }))).toMatch(/a lot of crew work/);
    expect(launchErrorMessage(new ConvexError({ code: "AI_DISABLED" }))).toBe("AI work is switched off right now. Try again later.");
    expect(launchErrorMessage(new Error("secret"))).toBe("Something went wrong. Try again.");
  });
});

describe("workstream links, plan, why rows", () => {
  test("only built pages get a link; the rest are null", () => {
    expect(workstreamFor("brand", "p1")).toEqual({ href: "/dashboard/b/p1/brand", label: "Open Brand kit" });
    expect(workstreamFor("email", "p1")).toEqual({ href: "/dashboard/b/p1/email", label: "Open Email" });
    expect(workstreamFor("social", "p1")).toEqual({ href: "/dashboard/b/p1/social", label: "Open Social" });
    for (const role of ["seo", "landing", "ads", "marketing", "engineering", "curriculum"] as const) {
      expect(workstreamFor(role, "p1")).toBeNull();
    }
  });

  test("step pill status", () => {
    expect(stepPillStatus({ state: "running", notBuilt: false })).toBe("working");
    expect(stepPillStatus({ state: "succeeded", notBuilt: false })).toBe("done");
    expect(stepPillStatus({ state: "skipped", notBuilt: true })).toBe("coming_soon");
    expect(stepPillStatus({ state: "skipped", notBuilt: false })).toBe("skipped");
    expect(stepPillStatus({ state: "waiting", notBuilt: false })).toBe("waiting");
    expect(stepPillStatus({ state: "paused", notBuilt: false })).toBe("paused");
  });

  test("planGroups puts built steps first, grouped by owner, then coming later", () => {
    const steps = [
      step("blueprint", "lead", "succeeded"),
      step("brand_kit", "brand", "succeeded"),
      step("logo_marks", "brand", "skipped", { notBuilt: true }),
      step("roster", "lead", "succeeded"),
    ];
    const groups = planGroups(steps);
    expect(groups.now.map((entry) => entry.key)).toEqual(["blueprint", "roster", "brand_kit"]);
    expect(groups.later.map((entry) => entry.key)).toEqual(["logo_marks"]);
  });

  test("planSummary counts unbuilt steps apart", () => {
    expect(planSummary([])).toBe("0 of 0 steps done.");
    expect(
      planSummary([
        step("a", "lead", "succeeded"),
        step("b", "brand", "running"),
        step("c", "seo", "skipped", { notBuilt: true }),
        step("d", "ads", "skipped", { notBuilt: true }),
      ]),
    ).toBe("1 of 2 steps done. 2 coming later.");
    expect(planSummary([step("a", "lead", "succeeded"), step("b", "brand", "skipped")])).toBe("1 of 1 steps done. 1 skipped for this team.");
  });

  test("whyRows covers hired (always or added) and skipped roles in catalogue order", () => {
    const rows = whyRows(
      [
        { role: "lead", name: "Wren", roleLabel: "Crew Lead", reason: "r1" },
        { role: "ads", name: "Ada", roleLabel: "Ads", reason: "r2" },
      ],
      [{ role: "outbound", roleLabel: "Outbound", reason: "r3" }],
    );
    expect(rows.map((row) => [row.role, row.decision])).toEqual([
      ["lead", "always"],
      ["ads", "added"],
      ["outbound", "skipped"],
    ]);
  });
});
