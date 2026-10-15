/// <reference types="vite/client" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import confirmSource from "../../app/email-signin/ConfirmEmailSignIn.tsx?raw";
import modalSource from "../../app/(marketing)/starter-kit/SubscribedModal.tsx?raw";
import picksSource from "../../components/platform/home/PickedForYou.tsx?raw";

const globalsSource = readFileSync("app/globals.css", "utf8");

describe("UX polish contracts", () => {
  test("confirm-sign-in unmounts the account card after success", () => {
    expect(confirmSource).toContain("setSignedIn(true)");
    expect(confirmSource).toContain("Signing you in…");
    expect(confirmSource).toContain("if (signedIn)");
  });

  test("starter-kit inbox modal mounts only after subscribed=true opens it", () => {
    expect(modalSource).toContain('subscribed") === "true"');
    expect(modalSource).toContain("if (!open) return null");
    expect(modalSource).toContain("Check your inbox!");
  });

  test("html/body canvas uses desk paper, not the retired dark root", () => {
    expect(globalsSource).toContain("html {");
    expect(globalsSource).toContain("background-color: #f7f3ec");
    expect(globalsSource).not.toMatch(/body\s*\{\s*background-color:\s*#050505/);
  });

  test("picked-for-you skeleton mirrors the three card grid", () => {
    expect(picksSource).toContain("md:grid-cols-3");
    expect(picksSource).toContain("min-h-[172px]");
    expect(picksSource).toContain("[0, 1, 2].map");
  });
});
