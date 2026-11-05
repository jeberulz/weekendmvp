import { describe, expect, test } from "vitest";
import type { Id } from "../../_generated/dataModel";
import { CopyConnector } from "./types";

describe("CopyConnector", () => {
  test("prepares copy without an external post or network call", async () => {
    const postId = "copy-fixture" as Id<"social_posts">;
    const connector = new CopyConnector();
    await expect(connector.publish({ postId, platform: "instagram", body: "Launch day" }))
      .resolves.toEqual({ status: "copy_ready", postId, copyText: "Launch day", externalId: null });
    await expect(connector.status(postId))
      .resolves.toEqual({ postId, status: "copy_ready", externalId: null });
  });
});
