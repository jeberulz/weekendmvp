import type { AudienceSlug, BuildTimeValue, RevenueGoalSlug, ToolSlug } from "../contracts/taxonomy";
import type { IdeaOrigin } from "../contracts/views";

export { CATEGORY_LABELS } from "../contracts/taxonomy";

export const TOOL_LABELS: Record<ToolSlug, string> = {
  cursor: "Cursor",
  claude: "Claude",
  bolt: "Bolt",
  v0: "v0",
  lovable: "Lovable",
  replit: "Replit",
  windsurf: "Windsurf",
  "no-code": "No-code",
};

export const AUDIENCE_LABELS: Record<AudienceSlug, string> = {
  developers: "Developers",
  designers: "Designers",
  "non-technical": "Non-technical",
  "solo-founders": "Solo founders",
  "weekend-builders": "Weekend builders",
  "side-hustlers": "Side hustlers",
  marketers: "Marketers",
  freelancers: "Freelancers",
  creators: "Creators",
  "small-business-owners": "Small business owners",
};

export const REVENUE_GOAL_LABELS: Record<RevenueGoalSlug, string> = {
  "1k-month": "$1k/month",
  "5k-month": "$5k/month",
  "10k-month": "$10k/month",
  "passive-income": "Passive income",
  "quick-wins": "Quick wins",
};

export function buildTimeLabel(value: BuildTimeValue): string {
  return `${value} hours`;
}

export const ORIGIN_LABELS: Record<IdeaOrigin, string> = {
  engine: "Engine draft",
  manual: "Manual",
  legacy: "Legacy — evidence not reverified",
};
