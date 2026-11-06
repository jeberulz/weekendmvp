import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildPackSchema, type BuildPack, type BuildPrompt } from "@/lib/workspace/contracts/artifacts";
import { hydrotrailBuildPack, lightBuildPack } from "@/lib/workspace/contracts/fixtures/hydrotrail";
import { checkBuildPackStandard, checkBuildPrompt, type PromptRole } from "@/lib/workspace/crew/checks";
import { lintIdeaMdx, lintPrompts } from "../../scripts/lib/prompt-standard.mjs";
import { readEnforcedSlugs } from "../../scripts/lib/prompt-standard-enforced.mjs";

type Block = { title: string; text: string };
type LintIssue = { code: string };

/** The lint's code for a rule, and the port's code for the same rule. */
const SHARED: readonly (readonly [string, string])[] = [
  ["setup-structure", "setup_structure"],
  ["setup-billing", "setup_billing"],
  ["setup-services", "setup_services"],
  ["setup-auth", "setup_auth"],
  ["setup-auth-rls", "setup_auth_rls"],
  ["setup-tables", "setup_tables"],
  ["setup-fence", "do_not_build"],
  ["next-pin", "next_pin"],
  ["done-when", "done_when"],
  ["fence", "code_fence"],
];

/** An idea prompt (one text with Do not build and Done when lines) as a `BuildPrompt`. */
function toBuildPrompt(block: Block): BuildPrompt {
  const body: string[] = [];
  let doNotBuild = "";
  let doneWhen = "";
  for (const line of block.text.split("\n")) {
    const fence = /^\s*do not build:?\s*(.*)$/i.exec(line);
    const done = /^\s*done when:?\s*(.*)$/i.exec(line);
    if (fence !== null) doNotBuild = (fence[1] ?? "").trim();
    else if (done !== null) doneWhen = (done[1] ?? "").trim();
    else body.push(line);
  }
  return { title: block.title, timeMinutes: 30, body: body.join("\n").trimEnd(), doNotBuild, doneWhen };
}

const portCodes = (block: Block, role: PromptRole): string[] =>
  checkBuildPrompt(toBuildPrompt(block), { role, billing: role === "setup" ? "hard" : "off" })
    .map((found) => found.code)
    .filter((code) => SHARED.some(([, port]) => port === code))
    // The idea corpus asks for a fence only on Project Setup; the build pack asks for it on every prompt.
    .filter((code) => code !== "do_not_build" || role === "setup")
    .sort();

/** The lint's verdict on one block: the other block in the pair is the compliant default. */
const lintCodes = (block: Block): string[] => {
  const pair: Block[] = block.title === "Project Setup" ? [block, { title: "Core Feature", text: core }] : [{ title: "Project Setup", text: setup }, block];
  const all: LintIssue[] = lintPrompts(pair).errors;
  return all
    .map((found) => SHARED.find(([lint]) => lint === found.code)?.[1])
    .filter((code): code is string => code !== undefined)
    .sort();
};

// --- a compliant idea, as in tests/prompts/prompt-standard.test.ts ---
const setup = [
  'Build the weekend MVP of "Example Tracker": one screen where a freelancer logs an hour and sees the week.',
  "Stack: Next.js, Supabase (Postgres and Supabase Auth with Google sign-in), hosted on Vercel.",
  "One login path only: Supabase Auth with Google. Turn on Row Level Security.",
  "Tables:",
  "- clients(id, user_id, name): who the hours are for",
  "- entries(id, client_id, minutes, note, logged_at): one logged block of time",
  "- weeks(id, user_id, starts_on, total_minutes): the cached weekly total",
  "Screens: /login, /log, /week.",
  "Env vars (names only): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  "",
  "Do not build: billing or plans, teams, an admin area.",
  "Done when: npm run dev starts, you can sign in with Google, and the three tables exist with Row Level Security on.",
].join("\n");
const core = [
  "Build the one core feature: log an hour in two taps.",
  "1. A form with client, minutes and an optional note.",
  "2. Saving writes one row to entries and updates weeks.total_minutes.",
  "3. /week lists the seven days with a total per day.",
  "Done when: you can log three entries and /week shows the right totals.",
].join("\n");

const blocks = (setupText: string, coreText: string): Block[] => [
  { title: "Project Setup", text: setupText },
  { title: "Core Feature", text: coreText },
];

describe("port parity with scripts/lib/prompt-standard.mjs", () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ["compliant", setup, core],
    ["billing in setup", `${setup}\nAdd Stripe checkout flow.`, core],
    ["billing named only in the fence", setup, core],
    ["too many services", `${setup}\nSend mail with Resend, text with Twilio and chat with Slack.`, core],
    ["two logins", `${setup}\nAlso offer Clerk sign-in.`, core],
    ["clerk with supabase", setup.replace("Supabase Auth with Google sign-in", "Clerk"), core],
    ["next pin in setup", setup.replace("Next.js,", "Next.js 15,"), core],
    ["next pin in core", setup, `${core}\nUse Next.js 16.`],
    ["a prose 'next 7 days' is no pin", setup, `${core}\nShow the next 7 days.`],
    ["no done when in core", setup, core.replace(/\nDone when:.*$/, "")],
    ["no fence line in setup", setup.replace(/Do not build:.*\n/, ""), core],
    ["two tables only", setup.replace(/- weeks\(.*\n/, ""), core],
    ["too short", ["Build it.", "Done when: it runs.", "Do not build: more."].join("\n"), core],
    ["code fence in core", setup, `${core}\n\`\`\`js\nx\n\`\`\``],
    ["catalog clerk is a product", setup.replace("freelancer logs", "Catalog Clerk logs"), core],
  ];

  it.each(cases)("%s", (_name, setupText, coreText) => {
    const set = blocks(setupText, coreText);
    expect(portCodes(set[0] as Block, "setup")).toEqual(lintCodes(set[0] as Block));
    expect(portCodes(set[1] as Block, "standard")).toEqual(lintCodes(set[1] as Block));
  });

  it("the cases above exercise every shared rule", () => {
    const seen = new Set<string>();
    for (const [, setupText, coreText] of cases) {
      const set = blocks(setupText, coreText);
      lintCodes(set[0] as Block).forEach((code) => seen.add(code));
      lintCodes(set[1] as Block).forEach((code) => seen.add(code));
    }
    expect([...seen].sort()).toEqual(SHARED.map(([, port]) => port).sort());
  });

  it("agrees on every enforced idea's real prompts and finds no errors in them", () => {
    const root = process.cwd();
    const slugs = [...(readEnforcedSlugs(root) as Set<string>)];
    expect(slugs.length).toBeGreaterThan(20);
    for (const slug of slugs) {
      const mdx = readFileSync(path.join(root, "content/ideas", `${slug}.mdx`), "utf8");
      const parsed: { blocks: Block[] } = lintIdeaMdx(mdx);
      parsed.blocks.forEach((block, index) => {
        const role: PromptRole = block.title === "Project Setup" ? "setup" : "standard";
        expect(portCodes(block, role), `${slug} / ${block.title} (${index})`).toEqual([]);
      });
    }
  });
});

describe("checkBuildPrompt", () => {
  const prompt = (patch: Partial<BuildPrompt> = {}): BuildPrompt => ({
    title: "Build the screens",
    timeMinutes: 45,
    body: "Build the Plan and Log screens with empty states.",
    doNotBuild: "charts or sharing.",
    doneWhen: "A signed-in hiker can create a route.",
    ...patch,
  });
  const codes = (p: BuildPrompt, role: PromptRole = "standard", billing?: "hard" | "soft" | "off"): string[] =>
    checkBuildPrompt(p, { role, billing }).map((found) => found.code);

  it("passes a clean prompt", () => {
    expect(checkBuildPrompt(prompt())).toEqual([]);
  });

  it("requires both labelled lines on every prompt", () => {
    expect(codes(prompt({ doneWhen: "" }))).toContain("done_when");
    expect(codes(prompt({ doNotBuild: "  " }))).toContain("do_not_build");
  });

  it("flags a Next.js major pin and a code fence", () => {
    expect(codes(prompt({ body: "Use Next.js 15 with the app router." }))).toContain("next_pin");
    expect(codes(prompt({ body: "Run:\n```\nnpm i\n```" }))).toContain("code_fence");
    expect(codes(prompt({ body: "Use Next.js with the app router." }))).toEqual([]);
  });

  it("flags a body that repeats the labels", () => {
    const found = checkBuildPrompt(prompt({ body: "Build it.\nDone when: it works." }));
    expect(found).toEqual([expect.objectContaining({ code: "duplicate_label", severity: "soft" })]);
  });

  it("treats billing by role and by ruling", () => {
    const billed = prompt({ body: "Add a checkout flow and a subscription for pro users." });
    expect(checkBuildPrompt(billed, { role: "setup" }).find((f) => f.code === "setup_billing")?.severity).toBe("hard");
    expect(checkBuildPrompt(billed).find((f) => f.code === "billing")?.severity).toBe("soft");
    expect(codes(billed, "standard", "off")).not.toContain("billing");
    expect(codes(billed, "standard", "hard")).toContain("billing");
  });

  it("does not count billing named in Do not build", () => {
    expect(codes(prompt({ doNotBuild: "billing, Stripe or a second login." }), "setup")).not.toContain("setup_billing");
  });

  it("does not read 'a bare checkout' or 'paid' as billing", () => {
    expect(codes(prompt({ body: "Show the abandoned checkout count on the Plan screen." }))).toEqual([]);
  });
});

describe("checkBuildPackStandard", () => {
  it("passes the HydroTrail full pack and the light pack (checkout allowed by the light default)", () => {
    expect(checkBuildPackStandard(hydrotrailBuildPack)).toEqual([]);
    expect(checkBuildPackStandard(lightBuildPack)).toEqual([]);
  });

  const withScaffoldFirst = (patch: Partial<BuildPrompt>): BuildPack => {
    if (hydrotrailBuildPack.weight !== "full") throw new Error("fixture is a full pack");
    const { scaffold } = hydrotrailBuildPack.phases;
    return {
      ...hydrotrailBuildPack,
      phases: {
        ...hydrotrailBuildPack.phases,
        scaffold: { ...scaffold, prompts: { ...scaffold.prompts, first: { ...scaffold.prompts.first, ...patch } } },
      },
    };
  };

  it("applies the setup rules to prompt 3 and reports its artifact path", () => {
    const pack = withScaffoldFirst({ body: `${(hydrotrailBuildPack.weight === "full" ? hydrotrailBuildPack.phases.scaffold.prompts.first.body : "")}\nAdd Stripe billing.` });
    const found = checkBuildPackStandard(pack);
    expect(found).toContainEqual(expect.objectContaining({ code: "setup_billing", severity: "hard", path: ["phases", "scaffold", "prompts", "first", "body"] }));
  });

  it("only holds the other seven prompts to the per-prompt rules", () => {
    if (hydrotrailBuildPack.weight !== "full") throw new Error("fixture is a full pack");
    const { core_loops } = hydrotrailBuildPack.phases;
    const pack: BuildPack = {
      ...hydrotrailBuildPack,
      phases: {
        ...hydrotrailBuildPack.phases,
        core_loops: { ...core_loops, prompts: { ...core_loops.prompts, first: { ...core_loops.prompts.first, body: "Use Next.js 15 and bill with a subscription." } } },
      },
    };
    const found = checkBuildPackStandard(pack);
    expect(found.map((f) => f.code).sort()).toEqual(["billing", "next_pin"]);
    expect(found.find((f) => f.code === "billing")?.severity).toBe("soft");
  });

  it("lets a ruling choose which prompts are setup prompts and how billing counts", () => {
    const pack = withScaffoldFirst({ body: "short" });
    expect(checkBuildPackStandard(pack, { setupPromptNumbers: [] }).map((f) => f.code)).toEqual([]);
    expect(checkBuildPackStandard(pack, { setupPromptNumbers: [3] }).map((f) => f.code)).toContain("setup_structure");
    const light = checkBuildPackStandard(
      { ...lightBuildPack, weight: "light", setupPrompts: [{ title: "Checkout", timeMinutes: 30, body: "Add a checkout flow.", doNotBuild: "a course platform.", doneWhen: "A test buyer pays." }] } as BuildPack,
      { billing: "hard" },
    );
    expect(light.map((f) => f.code)).toContain("billing");
  });

  it("flags too many outside services in the stack and a Next.js pin in the stack or PRODUCT.md", () => {
    const stack = ["A", "B", "C", "D"].map((label) => ({ label, value: `Service ${label}`, outsideService: true }));
    const pack = { ...hydrotrailBuildPack, stack, productMd: "# X\n\nBuilt on Next.js 15." } as BuildPack;
    const found = checkBuildPackStandard(pack).map((f) => f.code);
    expect(found).toEqual(expect.arrayContaining(["stack_services", "next_pin"]));
    expect(buildPackSchema.safeParse(pack).success).toBe(false);
  });
});
