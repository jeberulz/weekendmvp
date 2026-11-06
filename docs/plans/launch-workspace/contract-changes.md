# Contract changes after G0

The `05-lanes-codex-claude.md` §5 log. One line per change: date, contract, change, consumers affected, and who
acknowledged it. Changes are additive unless the owner approved a breaking one.

| Date | Contract | Change | Consumers affected | Acknowledged |
|---|---|---|---|---|
| 2026-11-06 | C-DATA (`ops_settings`) | WP70-S4 (#191) adds two optional fields, `spendAlarmState` and `spendAlarmPreviousDayState`, holding the daily 80% / 100% alarm markers per pool. Additive; no existing field changed. | Ops console (reads), spend alarm cron (writes). No Claude-lane code reads them yet. | Claude orchestrator, at G1 (recorded after merge; Codex asked for it before) |
| 2026-11-06 | C-METER (behaviour, no type change) | Under the 2026-11-06 shutdown rulings, `reserve` and `markSent` can throw workspace-gate errors (`AI_DISABLED` with an optional `scope`, `WORKSPACE_DISABLED`, `RESOURCE_NOT_FOUND`) without a `message`, alongside `MeterErrorData`. The contract text should say so; Codex may add a `message`. | The WP71 gateway already classifies both shapes as `meter_refused` (#192). | Claude orchestrator, at G1 |
