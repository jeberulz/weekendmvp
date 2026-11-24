import { z } from "zod";
import { LIMITS, SOCIAL_DAYS, socialPackSchema, socialPostSchema, type SocialPack } from "../contracts/artifacts.ts";

// Every wire row has the same required keys. An empty alt or option list
// represents an absent optional field in the stored artifact.
const postRow = z.strictObject({
  ...socialPostSchema.shape,
  imageAlt: z.string().max(LIMITS.common.alt).describe("Alt text for an image or carousel. An empty string is allowed for other formats."),
  pollOptions: z.array(z.string().min(1).max(LIMITS.socialPack.pollOption)).max(LIMITS.socialPack.pollOptionsMax)
    .describe("Two to four options for a poll. An empty array for every other format."),
  hashtags: z.array(z.string().min(1).max(LIMITS.socialPack.hashtag + 1)).max(LIMITS.socialPack.hashtagsMax)
    .describe("Distinct words or underscores. A leading # is optional."),
});

function artifactPost(row: z.infer<typeof postRow>) {
  const { imageAlt, pollOptions, hashtags, ...copy } = row;
  return {
    ...copy,
    ...(imageAlt === "" ? {} : { imageAlt }),
    ...(pollOptions.length === 0 ? {} : { pollOptions }),
    hashtags: hashtags.map((tag) => tag.replace(/^#/, "")),
  };
}

export const socialPackReplySchema = z.strictObject({
  posts: z.array(postRow).length(SOCIAL_DAYS.length).describe("Exactly seven rows, in order from Friday through Thursday."),
}).superRefine((reply, ctx) => {
  for (const [index, row] of reply.posts.entries()) {
    const post = socialPostSchema.safeParse(artifactPost(row));
    if (!post.success) {
      for (const issue of post.error.issues) {
        ctx.addIssue({ code: "custom", path: ["posts", index, ...issue.path], message: issue.message });
      }
    }
  }
  if (reply.posts[0]?.kind !== "launch") {
    ctx.addIssue({ code: "custom", path: ["posts", 0, "kind"], message: "Friday's post must announce the launch" });
  }
});

export type SocialPackReply = z.infer<typeof socialPackReplySchema>;

/** The application owns day assignment and schema version. All publication and quality gates consume this artifact. */
export function decodeSocialPackReply(raw: unknown): SocialPack {
  const { posts } = socialPackReplySchema.parse(raw);
  return socialPackSchema.parse({
    schemaVersion: 1,
    posts: Object.fromEntries(SOCIAL_DAYS.map((day, index) => [day, artifactPost(posts[index])])),
  });
}
