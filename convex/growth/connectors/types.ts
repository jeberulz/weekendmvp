import type { Id } from "../../_generated/dataModel";

export type SocialPlatform = "instagram" | "facebook" | "x" | "linkedin" | "other";

export type SocialPublishRequest = {
  postId: Id<"social_posts">;
  platform: SocialPlatform;
  body: string;
};

export type SocialPublishResult =
  | { status: "copy_ready"; postId: Id<"social_posts">; copyText: string; externalId: null }
  | { status: "posted"; postId: Id<"social_posts">; copyText: null; externalId: string };

export type SocialStatusResult = {
  postId: Id<"social_posts">;
  status: "copy_ready" | "posted" | "failed";
  externalId: string | null;
};

/** The caller owns authorization, approval recheck and persistence. */
export interface SocialConnector {
  publish(request: SocialPublishRequest): Promise<SocialPublishResult>;
  status(postId: Id<"social_posts">): Promise<SocialStatusResult>;
}

export type AdsCampaignRequest = {
  campaignId: Id<"ad_campaigns">;
  platform: "meta";
  objective: string;
  dailyBudgetCents: bigint;
};

export type AdsCampaignResult = {
  campaignId: Id<"ad_campaigns">;
  externalId: string | null;
  status: "draft" | "active" | "paused" | "failed";
};

export type AdsMetrics = {
  campaignId: Id<"ad_campaigns">;
  impressions: number;
  clicks: number;
  spendCents: bigint;
};

/** The caller owns authorization, approved ad_launch and persistence. */
export interface AdsConnector {
  createCampaign(request: AdsCampaignRequest): Promise<AdsCampaignResult>;
  pause(campaignId: Id<"ad_campaigns">): Promise<AdsCampaignResult>;
  metrics(campaignId: Id<"ad_campaigns">): Promise<AdsMetrics>;
}

/** Phase 0 fixture: preparing copy is local and never publishes or sends. */
export class CopyConnector implements SocialConnector {
  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    return {
      status: "copy_ready",
      postId: request.postId,
      copyText: request.body,
      externalId: null,
    };
  }

  async status(postId: Id<"social_posts">): Promise<SocialStatusResult> {
    return { postId, status: "copy_ready", externalId: null };
  }
}
