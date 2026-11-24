import { SOCIAL_DAYS } from "../contracts/artifacts";

const FIELDS: Record<string, string> = {
  kind: "post kind", format: "format", hook: "hook", caption: "caption", shortCaption: "short caption",
  imageText: "card text", imageAlt: "image description", pollOptions: "poll options", hashtags: "hashtags",
};

/** Store only known day and field labels. Provider text and unknown property names never reach the read model. */
export function socialSchemaFailure(issues: readonly string[]): string {
  const labels = new Set<string>();
  for (const issue of issues) {
    const path = /^posts\.([0-6]|fri|sat|sun|mon|tue|wed|thu)\.([a-zA-Z]+)(?:\.\d+)?: [a-z_]+$/.exec(issue);
    if (path && Object.hasOwn(FIELDS, path[2])) {
      const day = /^\d$/.test(path[1]) ? SOCIAL_DAYS[Number(path[1])] : path[1];
      labels.add(`${day.charAt(0).toUpperCase()}${day.slice(1)} ${FIELDS[path[2]]}`);
      if (labels.size >= 3) break;
    }
  }
  return labels.size === 0
    ? "The model returned an invalid seven-post draft."
    : `The model returned an invalid seven-post draft (${[...labels].join(", ")}).`;
}
