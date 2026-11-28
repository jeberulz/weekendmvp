import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { recordHash } from "@/lib/guides/guide-review";
import {
  buildRecheckFile,
  closestPassage,
  DEFAULT_RECHECK_DAYS,
  DRIFT_MIN_SIMILARITY,
  fetchPages,
  recheckClaims,
  recheckEvidence,
  recheckFileSchema,
  recheckIsClean,
  recheckIsComplete,
  recheckSchedule,
  type PageResult,
} from "@/lib/guides/recheck";
import { researchRecordSchema } from "@/lib/guides/research-record";

const NOW = Date.parse("2026-11-27T12:00:00Z");

const PLAN_EXCERPT = "Claude reads files and proposes a plan but makes no edits until you approve.";
const SKILL_EXCERPT = "Create a SKILL.md file with instructions, and Claude adds it to its toolkit.";

const record = () =>
  researchRecordSchema.parse({
    contractVersion: 1,
    slug: "recheck-fixture",
    sources: [
      { id: "docs-plan", url: "https://docs.example.test/plan", publisher: "Example", title: "Plan mode", dateChecked: "2026-10-01" },
      { id: "docs-skills", url: "https://docs.example.test/skills", publisher: "Example", title: "Skills", dateChecked: "2026-10-01" },
    ],
    evidence: [{ id: "ev-solo", label: "Built solo", verify: { type: "owner-statement", statement: "John said he built it solo.", statedOn: "2026-11-01" } }],
    claims: [
      { id: "tf-plan", kind: "tool-fact", text: "In plan mode Claude proposes a plan first.", sourceId: "docs-plan", excerpt: PLAN_EXCERPT, asOf: "2026-10-01" },
      { id: "tf-skills", kind: "tool-fact", text: "A skill is a SKILL.md file.", sourceId: "docs-skills", excerpt: SKILL_EXCERPT, asOf: "2026-10-01" },
      { id: "fh-solo", kind: "first-hand", text: "John built it solo.", evidenceId: "ev-solo" },
    ],
  });

const filler = "The quick brown fox jumps over the lazy dog while the page talks about unrelated navigation and cookies. ";
const longPage = (middle: string) => `${filler.repeat(40)}${middle} ${filler.repeat(40)}`;

const pages = (entries: Record<string, PageResult>) => new Map(Object.entries(entries));

describe("closestPassage", () => {
  test("finds a reworded sentence and returns it in the page's own words", () => {
    const reworded = "In plan mode, Claude reads files and creates a plan, but makes no edits until you approve it.";
    const near = closestPassage(PLAN_EXCERPT, longPage(reworded));
    expect(near).not.toBeNull();
    expect(near!.similarity).toBeGreaterThanOrEqual(0.8);
    expect(near!.text).toContain("Claude reads files and creates a plan");
    expect(near!.text).toContain("until you approve");
    // It is the page's whole sentence: no page filler before it, and not cut off before "it."
    expect(near!.text).toBe(reworded);
  });

  test("it grows to the end of the sentence, but not across a long run of menu text with no full stop", () => {
    const menu = "Home Docs Guides Pricing Account Settings Log in Sign up Copy page Copy page Copy page Copy page ";
    const near = closestPassage(PLAN_EXCERPT, `${menu}Claude reads files and creates a plan but makes no edits until you approve it. And more text follows.`);
    expect(near!.text).toBe("Claude reads files and creates a plan but makes no edits until you approve it.");
    expect(near!.text).not.toContain("Copy page");
    expect(near!.text).not.toContain("And more text");
    const noStop = closestPassage(PLAN_EXCERPT, `${menu}Claude reads files and creates a plan but makes no edits until you approve ${menu.repeat(3)}`);
    expect(noStop!.text.endsWith("approve")).toBe(true);
  });

  test("an identical sentence scores 1, and a page about something else scores low", () => {
    expect(closestPassage(PLAN_EXCERPT, longPage(PLAN_EXCERPT))!.similarity).toBe(1);
    const unrelated = closestPassage(PLAN_EXCERPT, filler.repeat(80));
    expect(unrelated!.similarity).toBeLessThan(DRIFT_MIN_SIMILARITY);
  });

  test("case, punctuation and extra words in between do not hide a match", () => {
    const near = closestPassage(PLAN_EXCERPT, longPage("claude READS files, and then proposes a plan - but makes no edits until you approve!"));
    expect(near!.similarity).toBe(1);
  });

  test("an excerpt too short to compare, or an empty page, gives null", () => {
    expect(closestPassage("Two words", longPage("anything"))).toBeNull();
    expect(closestPassage(PLAN_EXCERPT, "")).toBeNull();
  });

  test("a page shorter than the excerpt still compares", () => {
    const near = closestPassage(PLAN_EXCERPT, "Claude reads files.");
    expect(near!.similarity).toBeGreaterThan(0);
    expect(near!.similarity).toBeLessThan(DRIFT_MIN_SIMILARITY + 0.2);
  });
});

describe("recheckClaims", () => {
  test("an excerpt still on the page is unchanged", () => {
    const result = recheckClaims(record(), pages({ "docs-plan": { text: longPage(PLAN_EXCERPT) }, "docs-skills": { text: longPage(SKILL_EXCERPT) } }));
    expect(result.map((r) => [r.claimId, r.status])).toEqual([["tf-plan", "unchanged"], ["tf-skills", "unchanged"]]);
  });

  test("a reworded sentence is drifted and reports the old and the new excerpt", () => {
    const now = "Claude reads files and creates a plan, but makes no edits until you approve it.";
    const result = recheckClaims(record(), pages({ "docs-plan": { text: longPage(now) }, "docs-skills": { text: longPage(SKILL_EXCERPT) } }));
    const drifted = result.find((r) => r.claimId === "tf-plan")!;
    expect(drifted.status).toBe("drifted");
    expect(drifted.oldExcerpt).toBe(PLAN_EXCERPT);
    expect(drifted.newExcerpt).toContain("creates a plan");
    expect(drifted.similarity).toBeGreaterThanOrEqual(DRIFT_MIN_SIMILARITY);
    expect(result.find((r) => r.claimId === "tf-skills")!.status).toBe("unchanged");
  });

  test("a sentence that is gone from a readable page is gone, with no new excerpt", () => {
    const result = recheckClaims(record(), pages({ "docs-plan": { text: filler.repeat(80) }, "docs-skills": { text: longPage(SKILL_EXCERPT) } }));
    const gone = result.find((r) => r.claimId === "tf-plan")!;
    expect(gone.status).toBe("gone");
    expect(gone.newExcerpt).toBeUndefined();
  });

  test("a page that could not be read, or a missing source, is unreachable and never unchanged", () => {
    const result = recheckClaims(record(), pages({ "docs-plan": { error: "HTTP 404" } }));
    expect(result.map((r) => [r.claimId, r.status])).toEqual([["tf-plan", "unreachable"], ["tf-skills", "unreachable"]]);
    expect(result[0].detail).toBe("HTTP 404");
    expect(result[1].detail).toContain("not in the record");
  });

  test("first-hand claims have no page, so they are not rechecked here", () => {
    const result = recheckClaims(record(), pages({ "docs-plan": { text: longPage(PLAN_EXCERPT) }, "docs-skills": { text: longPage(SKILL_EXCERPT) } }));
    expect(result.some((r) => r.claimId === "fh-solo")).toBe(false);
  });
});

describe("fetchPages", () => {
  test("each source is fetched once, html becomes text, and a failure is kept with its error", async () => {
    const calls: string[] = [];
    const map = await fetchPages(record(), async (url) => {
      calls.push(url);
      if (url.endsWith("/skills")) throw new Error("HTTP 503");
      return `<html><body><script>var x = 1;</script><p>${PLAN_EXCERPT}</p></body></html>`;
    });
    expect(calls).toEqual(["https://docs.example.test/plan", "https://docs.example.test/skills"]);
    expect(map.get("docs-plan")).toEqual({ text: PLAN_EXCERPT });
    expect(map.get("docs-skills")).toEqual({ error: "HTTP 503" });
  });
});

describe("recheckSchedule", () => {
  test("never checked, recent and overdue", () => {
    expect(recheckSchedule(undefined, 30, NOW)).toEqual({ neverChecked: true, daysSince: null, overdueByDays: 0 });
    expect(recheckSchedule("2026-11-17T12:00:00.000Z", 30, NOW)).toEqual({ neverChecked: false, daysSince: 10, overdueByDays: 0 });
    expect(recheckSchedule("2026-10-17T12:00:00.000Z", 30, NOW)).toEqual({ neverChecked: false, daysSince: 41, overdueByDays: 11 });
  });

  test("the day the cadence is reached is not yet overdue, the next day is", () => {
    expect(recheckSchedule("2026-10-28T12:00:00.000Z", 30, NOW).overdueByDays).toBe(0);
    expect(recheckSchedule("2026-10-27T12:00:00.000Z", 30, NOW).overdueByDays).toBe(1);
    expect(DEFAULT_RECHECK_DAYS).toBe(30);
  });
});

describe("recheckEvidence", () => {
  const withEvidence = () =>
    researchRecordSchema.parse({
      contractVersion: 1,
      slug: "evidence-fixture",
      sources: [{ id: "docs", url: "https://docs.example.test/x", publisher: "Example", title: "Docs", dateChecked: "2026-11-20" }],
      evidence: [
        { id: "ev-files", label: "Files", verify: { type: "file-count", dir: "content/ideas", ext: ".mdx", expect: 100, atLeast: true } },
        { id: "ev-prs", label: "Merged pull requests", verify: { type: "git-count", what: "pull-request-merges", expect: 300, atLeast: true } },
        { id: "ev-commits", label: "Commits", verify: { type: "git-count", what: "commits", expect: 1000, atLeast: true } },
        { id: "ev-solo", label: "Built solo", verify: { type: "owner-statement", statement: "John said he built it solo.", statedOn: "2026-11-01" } },
      ],
      claims: [
        { id: "tf-1", kind: "tool-fact", text: "A fact.", sourceId: "docs", excerpt: "Create a SKILL.md file with instructions", asOf: "2026-11-20" },
        { id: "fh-1", kind: "first-hand", text: "Many files.", evidenceId: "ev-files" },
        { id: "fh-2", kind: "first-hand", text: "Many PRs.", evidenceId: "ev-prs" },
        { id: "fh-3", kind: "first-hand", text: "Many commits.", evidenceId: "ev-commits" },
        { id: "fh-4", kind: "first-hand", text: "Built solo.", evidenceId: "ev-solo" },
      ],
    });

  test("a git count the repository cannot answer, like a shallow clone, is unchecked and never silently passed", () => {
    const shallow = recheckEvidence(withEvidence(), { countFiles: () => 231, gitCount: () => null });
    expect(shallow.unchecked).toEqual(["ev-prs", "ev-commits"]);
    expect(shallow.mismatch).toEqual([]);
  });

  test("an owner statement is never a gap, because no machine can check it", () => {
    const result = recheckEvidence(withEvidence(), { countFiles: () => 231, gitCount: () => 5000 });
    expect(result.unchecked).toEqual([]);
    expect(result.results.find((r) => r.evidenceId === "ev-solo")!.status).toBe("unverifiable");
  });

  test("a count that no longer holds is a mismatch, and a full clone with good counts is clean", () => {
    expect(recheckEvidence(withEvidence(), { countFiles: () => 99, gitCount: () => 5000 }).mismatch).toEqual(["ev-files"]);
    const clean = recheckEvidence(withEvidence(), { countFiles: () => 231, gitCount: () => 5000 });
    expect(clean.mismatch).toEqual([]);
    expect(clean.unchecked).toEqual([]);
  });
});

describe("the re-check file", () => {
  const claims = () =>
    recheckClaims(record(), pages({ "docs-plan": { text: longPage("Claude reads files and creates a plan, but makes no edits until you approve it.") }, "docs-skills": { text: longPage(SKILL_EXCERPT) } }));

  test("it is bound to the record's hash, counts each status and parses", () => {
    const file = buildRecheckFile({ record: record(), claims: claims(), evidenceMismatch: 0, evidenceUnchecked: 0, checkedAt: "2026-11-27T12:00:00.000Z", everyDays: 30 });
    expect(file.recordHash).toBe(recordHash(record()));
    expect(file.counts).toEqual({ unchanged: 1, drifted: 1, gone: 0, unreachable: 0, evidenceMismatch: 0, evidenceUnchecked: 0 });
    expect(recheckFileSchema.safeParse(JSON.parse(JSON.stringify(file))).success).toBe(true);
    expect(recheckIsClean(file)).toBe(false);
  });

  test("a clean run is clean, and any drift, gone, unreachable page or wrong count is not", () => {
    const clean = { counts: { unchanged: 2, drifted: 0, gone: 0, unreachable: 0, evidenceMismatch: 0, evidenceUnchecked: 0 } };
    expect(recheckIsClean(clean)).toBe(true);
    expect(recheckIsComplete(clean)).toBe(true);
    for (const key of ["drifted", "gone", "unreachable", "evidenceMismatch", "evidenceUnchecked"] as const) {
      expect(recheckIsClean({ counts: { ...clean.counts, [key]: 1 } })).toBe(false);
    }
    // Drift and a wrong count are findings, but the check still ran. An unread page or an unchecked count did not.
    expect(recheckIsComplete({ counts: { ...clean.counts, drifted: 3, evidenceMismatch: 1 } })).toBe(true);
    expect(recheckIsComplete({ counts: { ...clean.counts, unreachable: 1 } })).toBe(false);
    expect(recheckIsComplete({ counts: { ...clean.counts, evidenceUnchecked: 1 } })).toBe(false);
  });

  test("changing the record changes the hash the file was bound to", () => {
    const file = buildRecheckFile({ record: record(), claims: claims(), evidenceMismatch: 0, evidenceUnchecked: 0, checkedAt: "2026-11-27T12:00:00.000Z", everyDays: 30 });
    const edited = researchRecordSchema.parse({ ...record(), claims: record().claims.map((c) => (c.id === "tf-plan" ? { ...c, text: "A different sentence." } : c)) });
    expect(recordHash(edited)).not.toBe(file.recordHash);
  });

  test("a malformed file is refused", () => {
    expect(recheckFileSchema.safeParse({ contractVersion: 1, slug: "x" }).success).toBe(false);
    expect(recheckFileSchema.safeParse({ contractVersion: 2 }).success).toBe(false);
  });
});

describe("guide:source-review recheck CLI", () => {
  const recordsDir = path.join(process.cwd(), "guides", "records");
  const created: string[] = [];
  const pageDirs: string[] = [];
  afterEach(() => {
    for (const file of created.splice(0)) fs.rmSync(file, { force: true });
    for (const dir of pageDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    // The records folder is shared with other test files that run at the same time, so it is left in place.
  });

  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/guide-source-review.mjs", ...args], { encoding: "utf8" });

  const rawRecord = (over: { evidenceExpect?: number } = {}) => ({
    contractVersion: 1,
    slug: "x",
    sources: [
      { id: "docs-plan", url: "https://docs.example.test/plan", publisher: "Example", title: "Plan mode", dateChecked: "2026-11-20" },
      { id: "docs-skills", url: "https://docs.example.test/skills", publisher: "Example", title: "Skills", dateChecked: "2026-11-20" },
    ],
    evidence: [{ id: "ev-ideas", label: "Idea pages", verify: { type: "file-count", dir: "content/ideas", ext: ".mdx", expect: over.evidenceExpect ?? 100, atLeast: true } }],
    claims: [
      { id: "tf-plan", kind: "tool-fact", text: "In plan mode Claude proposes a plan first.", sourceId: "docs-plan", excerpt: PLAN_EXCERPT, asOf: "2026-11-20" },
      { id: "tf-skills", kind: "tool-fact", text: "A skill is a SKILL.md file.", sourceId: "docs-skills", excerpt: SKILL_EXCERPT, asOf: "2026-11-20" },
      { id: "fh-ideas", kind: "first-hand", text: "More than 100 idea pages live here.", evidenceId: "ev-ideas" },
    ],
    allowedNumbers: [],
  });

  const writeRecord = (name: string, raw: ReturnType<typeof rawRecord> = rawRecord()) => {
    fs.mkdirSync(recordsDir, { recursive: true });
    const file = path.join(recordsDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...raw, slug: name }, null, 2));
    created.push(file, file.replace(/\.json$/, ".recheck.json"), file.replace(/\.json$/, ".source-review.json"));
    return `guides/records/${name}.json`;
  };

  /** Saved pages, one html file per source id. A source left out has no saved page, so it cannot be read. */
  const savedPages = (pages: Record<string, string>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "recheck-pages-"));
    pageDirs.push(dir);
    for (const [id, body] of Object.entries(pages)) fs.writeFileSync(path.join(dir, `${id}.html`), `<html><body><p>${body}</p></body></html>`);
    return dir;
  };
  const unchangedPages = () => savedPages({ "docs-plan": longPage(PLAN_EXCERPT), "docs-skills": longPage(SKILL_EXCERPT) });
  const NOW_ARG = "--now=2026-11-27";

  test("a clean run exits 0, counts each claim and says it was never re-checked before", () => {
    const rel = writeRecord("zz-test-recheck-clean");
    const result = run("recheck", `--record=${rel}`, `--pages-dir=${unchangedPages()}`, NOW_ARG);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("recheck-never");
    expect(result.stdout).toContain("2 unchanged, 0 drifted, 0 gone, 0 unreachable");
    expect(result.stdout).toContain("evidence-verified");
  });

  test("a stale claim is reported with the old and the new excerpt, and the run fails", () => {
    const rel = writeRecord("zz-test-recheck-drift");
    const reworded = "Claude reads files and creates a plan, but makes no edits until you approve it.";
    const pages = savedPages({ "docs-plan": longPage(reworded), "docs-skills": longPage(SKILL_EXCERPT) });
    const result = run("recheck", `--record=${rel}`, `--pages-dir=${pages}`, NOW_ARG);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("claim-drifted");
    expect(result.stdout).toContain(`old: "${PLAN_EXCERPT}"`);
    expect(result.stdout).toContain('new: "Claude reads files and creates a plan, but makes no edits until you approve it."');
    expect(result.stdout).toContain("1 unchanged, 1 drifted");
  });

  test("a removed sentence is gone, and a page that cannot be read is unreachable. Both fail the run", () => {
    const rel = writeRecord("zz-test-recheck-gone");
    const pages = savedPages({ "docs-plan": filler.repeat(80) });
    const result = run("recheck", `--record=${rel}`, `--pages-dir=${pages}`, NOW_ARG);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("claim-gone");
    expect(result.stdout).toContain("claim-unreachable");
    expect(result.stdout).toContain('no saved page for source "docs-skills"');
  });

  test("a first-hand count that no longer holds fails the run", () => {
    const rel = writeRecord("zz-test-recheck-evidence", rawRecord({ evidenceExpect: 1_000_000 }));
    const result = run("recheck", `--record=${rel}`, `--pages-dir=${unchangedPages()}`, NOW_ARG);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("evidence-mismatch");
    expect(result.stdout).toContain("1 evidence mismatches");
  });

  test("--write saves the result, a later run reads the cadence from it, and a changed record is noticed", () => {
    const rel = writeRecord("zz-test-recheck-cadence");
    const pages = unchangedPages();
    const first = run("recheck", `--record=${rel}`, `--pages-dir=${pages}`, NOW_ARG, "--write");
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("recheck-written");
    const sidecar = path.join(process.cwd(), rel.replace(/\.json$/, ".recheck.json"));
    const saved = recheckFileSchema.parse(JSON.parse(fs.readFileSync(sidecar, "utf8")));
    expect(saved.checkedAt).toBe("2026-11-27T12:00:00.000Z");
    expect(saved.counts.unchanged).toBe(2);

    const soon = run("recheck", `--record=${rel}`, `--pages-dir=${pages}`, "--now=2026-12-07");
    expect(soon.status).toBe(0);
    expect(soon.stdout).toContain("recheck-last");
    expect(soon.stdout).toContain("10 days ago");

    const late = run("recheck", `--record=${rel}`, `--pages-dir=${pages}`, "--now=2027-01-07");
    expect(late.status).toBe(0);
    expect(late.stdout).toContain("recheck-overdue");
    expect(late.stdout).toContain("41 days ago, the cadence is 30 days");

    const custom = run("recheck", `--record=${rel}`, `--pages-dir=${pages}`, "--now=2027-01-07", "--every=60");
    expect(custom.stdout).toContain("recheck-last");

    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), "utf8"));
    raw.claims[0].text = "A different sentence about plan mode.";
    fs.writeFileSync(path.join(process.cwd(), rel), JSON.stringify(raw, null, 2));
    expect(run("recheck", `--record=${rel}`, `--pages-dir=${pages}`, NOW_ARG).stdout).toContain("recheck-record-changed");
  });

  test("a re-check with a page it could not read is not saved, so the clock is not reset", () => {
    const rel = writeRecord("zz-test-recheck-incomplete");
    const pages = savedPages({ "docs-plan": longPage(PLAN_EXCERPT) });
    const result = run("recheck", `--record=${rel}`, `--pages-dir=${pages}`, NOW_ARG, "--write");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("recheck-not-written");
    expect(fs.existsSync(path.join(process.cwd(), rel.replace(/\.json$/, ".recheck.json")))).toBe(false);
  });

  test("a git count the clone cannot answer makes the re-check incomplete, so it fails and is not saved", () => {
    const raw = rawRecord();
    raw.evidence.push({ id: "ev-prs", label: "Merged pull requests", verify: { type: "git-count", what: "pull-request-merges", expect: 0, atLeast: true } } as never);
    raw.claims.push({ id: "fh-prs", kind: "first-hand", text: "Pull requests were merged.", evidenceId: "ev-prs" } as never);
    const rel = writeRecord("zz-test-recheck-shallow", raw);
    const sidecar = path.join(process.cwd(), rel.replace(/\.json$/, ".recheck.json"));
    const result = run("recheck", `--record=${rel}`, `--pages-dir=${unchangedPages()}`, NOW_ARG, "--write");
    // Git can only count on a full clone. A shallow clone, which is what GitHub Actions checks out by default, cannot.
    const shallow = spawnSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).stdout.trim() === "true";
    if (shallow) {
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("evidence-unchecked");
      expect(result.stdout).toContain("1 evidence unchecked");
      expect(result.stdout).toContain("recheck-not-written");
      expect(fs.existsSync(sidecar)).toBe(false);
    } else {
      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain("evidence-unchecked");
      expect(fs.existsSync(sidecar)).toBe(true);
    }
  });

  test("a re-check changes neither the record nor the sealed review", () => {
    const rel = writeRecord("zz-test-recheck-readonly");
    const review = path.join(process.cwd(), rel.replace(/\.json$/, ".source-review.json"));
    fs.writeFileSync(review, '{"sealed":"as is"}');
    const before = [fs.readFileSync(path.join(process.cwd(), rel), "utf8"), fs.readFileSync(review, "utf8")];
    run("recheck", `--record=${rel}`, `--pages-dir=${unchangedPages()}`, NOW_ARG, "--write");
    expect([fs.readFileSync(path.join(process.cwd(), rel), "utf8"), fs.readFileSync(review, "utf8")]).toEqual(before);
  });

  test("--all rechecks every record and skips the review and re-check files beside them", () => {
    const good = writeRecord("zz-test-recheck-all-a");
    writeRecord("zz-test-recheck-all-b");
    fs.writeFileSync(path.join(process.cwd(), good.replace(/\.json$/, ".source-review.json")), "not a record");
    // No saved pages for --all, so every source is unreachable and the run fails for both records.
    const result = run("recheck", "--all", NOW_ARG, "--json");
    const body = JSON.parse(result.stdout) as { ok: boolean; results: { slug: string; file: string; findings: { rule: string }[] }[] };
    expect(body.ok).toBe(false);
    // Other test files write records into the same folder at the same time, so look only at this test's own.
    const mine = body.results.filter((r) => r.slug.startsWith("zz-test-recheck-all"));
    expect(mine.map((r) => r.slug)).toEqual(["zz-test-recheck-all-a", "zz-test-recheck-all-b"]);
    expect(mine.every((r) => r.findings.some((f) => f.rule === "claim-unreachable") && !r.findings.some((f) => f.rule === "record-invalid"))).toBe(true);
    // The review file beside a record is never treated as a record.
    expect(body.results.some((r) => r.file.endsWith(".source-review.json") || r.file.endsWith(".recheck.json"))).toBe(false);
  });

  test("--json carries the old and new excerpt for a program to read", () => {
    const rel = writeRecord("zz-test-recheck-json");
    const pages = savedPages({ "docs-plan": longPage("Claude reads files and creates a plan, but makes no edits until you approve it."), "docs-skills": longPage(SKILL_EXCERPT) });
    const body = JSON.parse(run("recheck", `--record=${rel}`, `--pages-dir=${pages}`, NOW_ARG, "--json").stdout) as {
      ok: boolean;
      results: { report: { claims: { claimId: string; status: string; oldExcerpt: string; newExcerpt?: string }[] } }[];
    };
    expect(body.ok).toBe(false);
    const drifted = body.results[0].report.claims.find((c) => c.claimId === "tf-plan")!;
    expect(drifted).toMatchObject({ status: "drifted", oldExcerpt: PLAN_EXCERPT });
    expect(drifted.newExcerpt).toContain("creates a plan");
  });

  test("bad arguments are a usage error, exit 2, and nothing is fetched", () => {
    const rel = writeRecord("zz-test-recheck-usage");
    const pages = unchangedPages();
    expect(run("recheck").status).toBe(2);
    expect(run("recheck", "--all", `--record=${rel}`).status).toBe(2);
    expect(run("recheck", "--all", `--pages-dir=${pages}`).status).toBe(2);
    expect(run("recheck", `--record=${rel}`, "--every=0").status).toBe(2);
    expect(run("recheck", `--record=${rel}`, "--every=abc").status).toBe(2);
    expect(run("recheck", `--record=${rel}`, "--pages-dir=/no/such/folder").status).toBe(2);
    expect(run("recheck", `--record=${rel.replace(/\.json$/, ".recheck.json")}`, `--pages-dir=${pages}`).status).toBe(2);
    expect(run("recheck", "--record=guides/records/zz-test-recheck-missing.json", `--pages-dir=${pages}`).status).toBe(2);
  });
});
