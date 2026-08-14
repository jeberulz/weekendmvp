/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import packetSource from "../../components/platform/publish/PublishPacket.tsx?raw";
import accountSource from "../../components/platform/shell/AccountMenu.tsx?raw";
import { PUBLISH_PACK_ID } from "../../lib/signed-in-home";

describe("publish packet", () => {
  test("is one address, one dollar price, one confirm", () => {
    expect(packetSource).toContain("PublishPacket");
    expect(packetSource).toContain("packId: PUBLISH_PACK_ID");
    expect(packetSource).toContain("publishPriceLabel");
    expect(packetSource).toContain("That address is not available");
    expect(packetSource).toContain("Paid. This site is not live yet.");
    expect(packetSource).not.toContain("starter");
    expect(packetSource).not.toContain("Builder");
    expect(packetSource).not.toContain("Studio");
    expect(packetSource).not.toContain("credit");
    expect(packetSource).not.toContain("/dashboard/billing");
    expect(PUBLISH_PACK_ID).toBe("starter");
  });
});

describe("account menu", () => {
  test("is email, optional switcher, optional receipt, and sign out", () => {
    expect(accountSource).toContain("user?.email");
    expect(accountSource).toContain("SignOutButton");
    expect(accountSource).toContain("others.length >= 2");
    expect(accountSource).toContain("Last charge");
    expect(accountSource).toContain("Update card");
    expect(accountSource).toContain("/api/platform/billing/portal");
    expect(accountSource).not.toContain("creditBalance");
    expect(accountSource).not.toContain("/dashboard/billing");
    expect(accountSource).not.toContain("Your sites (0)");
  });
});
