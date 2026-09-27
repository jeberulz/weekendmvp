# Idea page judge rubric (WP41 Layer 3)

Three judges from different model families score every idea page on six dimensions, 1 to 5. The page score per dimension is the median of the judges. The prompt is built from `lib/evals/rubric.ts`; keep this file and that one in sync and bump `RUBRIC_VERSION` when either changes (it invalidates cached scores).

Rules the judges follow:

- Score what is on the page, not the idea's merit.
- Any score of 3 or lower must quote the page word for word. A low score whose quote is not on the page is thrown out, so a judge cannot invent a criticism.
- Judges do not see the Layer 0-2 findings. They score independently.

Findings: median 2 or lower fails the page, median 3 warns, and judges that differ by 2 or more points on a dimension flag it for human review. Thresholds: `evals/config.json` → `judges`.

| Dimension | Question | 1 | 3 | 5 |
|---|---|---|---|---|
| `specificity` | Does the page name real things, or speak in generalities? | Generic throughout: no names, no numbers | Some named competitors or figures; market or business model stays vague | Named competitors with prices, named communities and tools, concrete numbers and steps everywhere |
| `slop` | Does it read like someone who knows the market, or stock AI output? | "In today's fast-paced world", "unlock", "game-changer", listicle rhythm | Mostly plain, several stock phrases | Plain, direct, specific. No filler, no hype |
| `verbosity` | Does every paragraph earn its place? | Could lose 40%+ with no loss | Could lose 15-25% | Every paragraph adds a fact, argument or step |
| `fake_data` | Do the figures look real and honestly sourced? | Unattributed precise or round figures, invented quotes, guesses stated as fact | Mostly attributed; some unattributed precise numbers or "inferred" values shown as data | Figures attributed, estimates labelled, nothing looks made up |
| `consistency` | Do the numbers agree across sections? | A price or total differs between sections; MRR math does not add up | Minor mismatches, loose math | Every repeated figure matches; arithmetic checks out |
| `actionability` | Could a builder act on this page this weekend? | No clear first step, stack or customer | Clear idea and stack, vague first customers or steps | Clear customer, wedge, stack, pricing and first steps |

Examples from our pages:

- `phone-neck-score-app`, Competitive Landscape: "Pricing: **about $4.99 per month inferred**" is an honest label, which is fine. Presenting that figure without "inferred" would lower `fake_data`.
- `ai-landing-page-generator-ecommerce`, The Problem: "U.S. digital ad spend topped $240 billion in 2024 alone" has no attribution, so a judge may mark `fake_data` down unless Sources backs it.
