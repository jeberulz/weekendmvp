import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/editorial",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

import { IdeaTable } from "@/components/admin/editorial/queue/IdeaTable";
import { QueueSummaryLine } from "@/components/admin/editorial/queue/QueueControls";
import { EditorialShell } from "@/components/admin/editorial/shell/EditorialShell";
import { createFixtureEnvironment, type FixtureEnvironment } from "@/lib/editorial/adapters/fixture/environment";
import { defaultIdeaFilter } from "@/lib/editorial/contracts/commands";

const NOW = Date.parse("2026-09-27T12:00:00Z");
let env: FixtureEnvironment;

beforeAll(async () => {
  env = await createFixtureEnvironment({ nowMs: NOW });
});

describe("editorial shell", () => {
  const html = () =>
    renderToStaticMarkup(
      <EditorialShell
        environment={{ mode: "fixture", connection: "In-memory fixture adapter", accountLabel: "Local demo editor (simulated)" }}
        counts={{ queue: 7, releases: 2 }}
      >
        <p>page body</p>
      </EditorialShell>,
    );

  test("the local-demo label is on every page and says nothing is real", () => {
    const markup = html();
    expect(markup).toContain("Local demo — fictional data.");
    expect(markup).toContain("the public site never changes");
    expect(markup).toContain('aria-label="Environment"');
  });

  test("its own navigation, a skip link and a focusable main landmark", () => {
    const markup = html();
    for (const label of ["Review queue", "Library", "Releases", "Trash", "Activity", "Settings"]) {
      expect(markup).toContain(`${label}</span>`);
    }
    expect(markup).toContain('href="#editorial-main"');
    expect(markup).toMatch(/<main id="editorial-main" tabindex="-1"/);
    expect(markup).toMatch(/aria-current="page"[^>]*href="\/admin\/editorial"|href="\/admin\/editorial"[^>]*aria-current="page"/);
    expect(markup).toContain("7<span class=\"sr-only\"> need review</span>");
    // No member-dashboard navigation leaks into the editorial shell.
    expect(markup).not.toContain("/dashboard");
  });
});

describe("idea table", () => {
  test("semantic table with a caption, column headers and text statuses", async () => {
    const page = await env.editor().listIdeas(defaultIdeaFilter("queue"), null, 25);
    if (!page.ok) throw new Error(page.error.message);
    const markup = renderToStaticMarkup(
      <IdeaTable items={page.value.items} variant="queue" nowMs={NOW} caption="Review queue" />,
    );
    expect(markup).toContain('<caption class="sr-only">Review queue</caption>');
    const headers = markup.match(/<th scope="col"/g) ?? [];
    expect(headers).toHaveLength(8);
    expect(markup).toContain("Live v2");
    expect(markup).toContain("Draft v3");
    expect(markup).toContain("1 blocking");
    expect(markup).toContain("Approval revoked");
    expect(markup).toContain(`href="/admin/editorial/ideas/${env.scenarios.flagshipLiveWithDraft}"`);
    expect(markup).not.toMatch(/style="/);
  });

  test("the summary line reports counts from data, each a link", async () => {
    const summary = await env.editor().getQueueSummary();
    if (!summary.ok) throw new Error(summary.error.message);
    const markup = renderToStaticMarkup(<QueueSummaryLine summary={summary.value} />);
    expect(markup).toContain(">7</span> need review");
    expect(markup).toContain(">4</span> blocked by evidence");
    expect(markup).toContain(">2</span> releases need attention");
    expect(markup).toContain('href="/admin/editorial/releases?group=attention"');
  });
});
