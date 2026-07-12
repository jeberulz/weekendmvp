# Program Manifest

Source of truth for Program/Migration Lane. Commit this before implementation starts. Workers may not re-litigate scope; disagreement means stop and escalate.

## Program

- Name:
- Owner:
- Orchestrator:
- Branch:
- Goal:
- Non-goals:
- Source docs:
- Required gates:

## Waves

| Wave | Purpose | Entry Criteria | Gate | Exit Criteria |
|---|---|---|---|---|
| 0 | Audit and manifest | Owner assignment | Manifest reviewed | Manifest committed |
| 1 | Reversible docs/tests/tooling | Wave 0 passed | Checks | Green |
| 2 | Reversible code | Wave 1 passed | Checks + flows | Green |
| 3 | Data-touching code | Wave 2 passed | Checks + backup inventory | Green |
| 4 | Production data mutation | Wave 3 passed | Dry-run + owner approval | Counts verified |
| 5 | Schema narrowing/irreversible cleanup | Wave 4 passed | Restore marker + checks | Green |
| 6 | Docs/agent knowledge closeout | Implementation complete | Docs review | Updated |

## Manifest Entries

| ID | Area | Files | Verdict | Risk | Wave | Worker | Dependencies | Boundary | Gate | Unknowns | Irreversible | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PM-001 |  |  | in_scope/out_of_scope/unknown | low/medium/high |  |  |  |  |  |  | no |  |

## Rulings Applied

| Date | Entry | Question | Ruling | Decider |
|---|---|---|---|---|
