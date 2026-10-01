# Engine calibration (WP41 gold set)

Generated 2026-10-01 by `npm run evals:calibrate -- --live --report` (live mode, $0.0000). Do not edit by hand.

**PASS**: caught 7/7 seeded bad pages (100%, need 90%), false fails on 0/5 good pages (need 0).

Gold set: `evals/gold/manifest.json`. Layers: 0 and 3 (judges). Claim checks are left out: they depend on live sources, not on the rubric.

## Pages

| Page | Label | Result | Detail |
|---|---|---|---|
| `ai-code-reviewer` | good | ok | no failures |
| `ai-rfp-response-assistant` | good | ok | no failures |
| `ai-landing-page-generator-ecommerce` | good | ok | no failures |
| `phone-neck-score-app` | good | ok | no failures |
| `contractor-ai-receptionist` | good | ok | no failures |
| `bad-slop` | bad | ok | caught: judges.slop |
| `bad-fake-data` | bad | ok | caught: judges.fake_data |
| `bad-verbose` | bad | ok | caught: judges.verbosity |
| `bad-inconsistent` | bad | ok | caught: judges.consistency |
| `bad-vague` | bad | ok | caught: judges.specificity |
| `bad-not-actionable` | bad | ok | caught: judges.actionability |
| `bad-placeholder` | bad | ok | caught: integrity.placeholder, slop.banned |

## Judges

Target hits: the judge scored the seeded flaw at the fail threshold. Good-page alarms: dimensions on good pages it scored at the fail threshold. Distance: mean gap from the panel median.

| Judge | Target hits | Good-page alarms | Discarded scores | Distance from median |
|---|---|---|---|---|
| `anthropic/claude-haiku-4.5` | 4/6 | 0 | 3 | 0.32 |
| `google/gemini-3.8-flash` | 6/6 | 0 | 0 | 0.35 |
| `openai/gpt-5.6-luna` | 5/6 | 0 | 0 | 0.39 |
