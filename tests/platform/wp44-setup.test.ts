/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import settingsPageSource from "../../app/dashboard/settings/page.tsx?raw";
import setupFormSource from "../../components/platform/home/SetupForm.tsx?raw";
import nextStepSource from "../../components/platform/home/NextStepCard.tsx?raw";
import picksSource from "../../components/platform/home/PickedForYou.tsx?raw";
import reasonSource from "../../components/platform/explore/ReasonLine.tsx?raw";
import cardSource from "../../components/platform/explore/IdeaCard.tsx?raw";
import librarySource from "../../components/platform/explore/IdeasLibrary.tsx?raw";
import settingsAnswersSource from "../../components/platform/settings/SettingsAnswers.tsx?raw";
import accountMenuSource from "../../components/platform/shell/AccountMenu.tsx?raw";
import shellSource from "../../components/platform/shell/WorkspaceShell.tsx?raw";
import { SETTINGS_NAV, isWorkspaceNavCurrent } from "../../components/platform/shell/workspace-current";

describe("WP44-S8 setup questions on Home", () => {
  test("three fieldsets with legends: tool checkboxes, hours and goal radios", () => {
    expect(setupFormSource.match(/<fieldset\b/g)?.length ?? 0).toBe(1);
    expect(setupFormSource).toContain('<Group legend="Which AI tools do you build with?">');
    expect(setupFormSource).toContain('<Group legend="How much time do you have most weekends?">');
    expect(setupFormSource).toContain('<Group legend="What do you want from it?">');
    expect(setupFormSource).toContain("<legend className={LEGEND}>{legend}</legend>");
    expect(setupFormSource).toContain('type="checkbox"');
    expect(setupFormSource.match(/type="radio"/g)).toHaveLength(2);
    // The native control stays visible: the chosen state is not colour alone.
    expect(setupFormSource).not.toMatch(/className="[^"]*sr-only[^"]*"\s*\/>/);
  });

  test("saving fires setup_completed with no free text", () => {
    expect(setupFormSource).toContain('name: "setup_completed"');
    expect(setupFormSource).toContain('hours_bucket: answers.weeklyHours ?? "none"');
    expect(setupFormSource).toContain("tools_count: answers.tools.length");
  });

  test("the card is skippable (R7) and hands focus to the next card", () => {
    expect(nextStepSource).toContain("Skip for now");
    expect(nextStepSource).toContain('name: "setup_skipped"');
    expect(nextStepSource).toContain("api.platform.preferences.skipSetup");
    expect(nextStepSource).toContain("focusOnMount={justSetUp}");
    expect(nextStepSource).toContain('ref={heading} tabIndex={-1}');
    expect(nextStepSource).toContain('<p role="status" className="sr-only">');
  });
});

describe("WP44-S8 reasons", () => {
  test("a reason line shows only when the ranking supplied one", () => {
    expect(reasonSource).toContain("if (!reason) return null;");
    expect(reasonSource).toContain("reasonText(reason)");
    expect(picksSource).toContain("<ReasonLine reason={idea.reason} />");
    expect(cardSource).toContain("<ReasonLine reason={idea.reason} />");
    expect(picksSource).not.toContain("Popular this month");
  });

  test("new answers start the pinned picks over", () => {
    expect(picksSource).toContain("<LivePicks key={prefs.updatedAt ?? 0} exclude={exclude} />");
    expect(picksSource).toContain("Answer the three questions above and these picks get personal.");
  });

  test("For you explains its inputs and links to edit them", () => {
    expect(librarySource).toContain("Ranked by research score, your setup answers and the ideas you save.");
    expect(librarySource).toContain('href="/dashboard/settings"');
  });
});

describe("WP44-S8 Settings", () => {
  test("is private, titled, and edits the same answers behind the Convex gate", () => {
    expect(settingsPageSource).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(settingsPageSource).toContain('title: "Settings"');
    expect(settingsPageSource).not.toMatch(/<main\b/);
    expect(settingsAnswersSource).toContain("<PersonalModule");
    expect(settingsAnswersSource).toContain("useQuery(api.platform.preferences.get)");
    expect(settingsAnswersSource).toContain('submitLabel="Save answers"');
  });

  test("sits in the account menu and the phone sheet", () => {
    expect(SETTINGS_NAV.href).toBe("/dashboard/settings");
    expect(accountMenuSource).toContain("<Link href={SETTINGS_NAV.href}>");
    expect(shellSource).toContain("<Link href={SETTINGS_NAV.href}");
    expect(isWorkspaceNavCurrent("settings", "/dashboard/settings", null)).toBe(true);
    expect(isWorkspaceNavCurrent("settings", "/dashboard/billing", null)).toBe(false);
  });
});
