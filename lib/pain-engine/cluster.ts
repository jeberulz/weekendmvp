/**
 * Pain Engine — clustering + scoring.
 *
 * Deterministic, no LLM: findings are grouped by token overlap (Jaccard
 * similarity on normalised words), then each cluster is scored on four
 * axes. Only top-scored clusters reach the writer, so expensive work is
 * never spent on a pain with one mention and no evidence.
 */
import { mentionsWorkaroundSpend, painIntensity } from "./extract.ts";
import type { ClusterScore, PainCluster, PainFinding } from "./types.ts";

const STOPWORDS = new Set(
  "a an the and or but if then else for to of in on at by with from as is are was were be been it its this that these those i you he she we they my your his her our their me him us them have has had do does did will would can could should there here what when where who which how not no yes so very just really much many more most some any all each".split(
    " ",
  ),
);

/** Light stem so invoice / invoices / invoicing count as one word. */
export function stem(word: string): string {
  if (word.length <= 4) return word;
  return word
    .replace(/ing$/, "")
    .replace(/es$/, "")
    .replace(/s$/, "")
    .replace(/e$/, "");
}

/** Normalised, stemmed content words of a finding (title + text). */
export function tokensOf(finding: PainFinding): Set<string> {
  const words = `${finding.title} ${finding.text}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
  return new Set(words);
}

/**
 * Overlap coefficient: shared words over the smaller finding's vocabulary.
 * Two reports of the same pain share a core vocabulary even when one is
 * long and the other is short, which plain Jaccard punishes.
 */
function overlap(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  const smaller = Math.min(a.size, b.size);
  return smaller === 0 ? 0 : shared / smaller;
}

/** Similarity at or above which two findings join one cluster. */
export const CLUSTER_SIMILARITY_THRESHOLD = 0.3;

/** Group findings into clusters of near-duplicate pains. */
export function clusterFindings(findings: PainFinding[]): PainCluster[] {
  const tokenSets = findings.map(tokensOf);
  const assigned = new Array<boolean>(findings.length).fill(false);
  const clusters: PainCluster[] = [];
  let n = 0;

  for (let i = 0; i < findings.length; i++) {
    if (assigned[i]) continue;
    assigned[i] = true;
    const members: PainFinding[] = [findings[i]];
    for (let j = i + 1; j < findings.length; j++) {
      if (assigned[j]) continue;
      if (overlap(tokenSets[i], tokenSets[j]) >= CLUSTER_SIMILARITY_THRESHOLD) {
        assigned[j] = true;
        members.push(findings[j]);
      }
    }
    n += 1;
    const id = `pain-${String(n).padStart(3, "0")}`;
    clusters.push({
      id,
      label: labelCluster(members),
      findings: members,
      sources: [...new Set(members.map((f) => f.source))].sort(),
      score: scoreCluster(members),
    });
  }
  return clusters.sort((a, b) => b.score.total - a.score.total);
}

/** Generic words that must never lead a cluster label. */
const LABEL_STOPWORDS = new Set(
  "every into from with after before just like take takes get gets make makes much many over under about than then when where while also even still back only more most some any first last next other same such very really would could should will can may might must shall need want know think feel seem look work use using used try tried got made took give given find found keep kept let put set run going come came say said tell ask asked thing things way ways get".split(
    " ",
  ),
);

/**
 * Label from the most frequent content words across the cluster.
 * Counted by stem (invoice / invoices / invoicing = one word) but displayed
 * in the most common real form, so humans read "invoice", not "invoic".
 * Generic words are excluded so the label names the pain, not the grammar.
 */
function labelCluster(members: PainCluster["findings"]): string {
  const counts = new Map<string, number>();
  const forms = new Map<string, Map<string, number>>();
  for (const finding of members) {
    const words = `${finding.title} ${finding.text}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !LABEL_STOPWORDS.has(stem(w)));
    const stems = new Set<string>();
    for (const word of words) {
      const s = stem(word);
      stems.add(s);
      const formCounts = forms.get(s) ?? new Map<string, number>();
      formCounts.set(word, (formCounts.get(word) ?? 0) + 1);
      forms.set(s, formCounts);
    }
    for (const s of stems) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([s]) => {
      const formCounts = forms.get(s) ?? new Map();
      return [...formCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? s;
    });
  return top.join(" ");
}

const BUILDABILITY_WORDS = [
  "spreadsheet",
  "manual",
  "email",
  "slack",
  "notion",
  "form",
  "dashboard",
  "report",
  "reminder",
  "template",
  "checklist",
  "invoice",
  "booking",
  "tracking",
];

/** Score one cluster. Each axis 0–10; total is the weighted sum (0–100). */
export function scoreCluster(members: PainFinding[]): ClusterScore {
  const distinctSources = new Set(members.map((f) => f.source)).size;
  const totalAgreement = members.reduce((sum, f) => sum + f.agreementCount, 0);

  // Frequency: distinct posts + distinct sources. 1 post = 2, 3 = 6, 5+ = 10.
  const frequency = Math.min(
    10,
    Math.round(members.length * 1.5 + distinctSources),
  );
  // Intensity: average pain wording across the cluster.
  const intensity = Math.round(
    members.reduce((sum, f) => sum + painIntensity(`${f.title} ${f.text}`), 0) /
      Math.max(1, members.length),
  );
  // Workaround spend: anyone already paying (or saying they would).
  const spendMentions = members.filter((f) =>
    mentionsWorkaroundSpend(`${f.title} ${f.text}`),
  ).length;
  const workaroundSpend = Math.min(10, spendMentions * 5 + (totalAgreement > 100 ? 2 : 0));
  // Buildability: small, concrete, weekend-shaped problem words.
  const joined = members.map((f) => `${f.title} ${f.text}`.toLowerCase()).join(" ");
  const buildHits = BUILDABILITY_WORDS.filter((w) => joined.includes(w)).length;
  const buildability = Math.min(10, 4 + buildHits);

  const total = Math.round(
    frequency * 4 + intensity * 3 + workaroundSpend * 2 + buildability * 1,
  );
  return {
    frequency,
    intensity,
    workaroundSpend,
    buildability,
    total,
    rationale:
      `${members.length} finding${members.length === 1 ? "" : "s"} from ` +
      `${distinctSources} source${distinctSources === 1 ? "" : "s"}; ` +
      `${totalAgreement} total agreement; ` +
      `${spendMentions} mention${spendMentions === 1 ? "s" : ""} paying for a workaround.`,
  };
}
