# Live builds: operator runbook (WP64-S8)

One live build a month, with a replay, is part of Builder's Hub (ruling "WP55 / bundle", 2026-10-04). Members see the schedule at `/dashboard/live`. This runbook is how the operator schedules, changes and cancels sessions. There is no admin UI.

Open decision O8 (slot, length, tool, capacity, replay hosting, captions, missed months) is still the owner's call. The steps below work for any choice.

## Rules

- Every command is an internal Convex mutation. It needs a deploy key for the target deployment. Never run one against production without the owner's go-ahead.
- Never paste a join or replay link into a doc, a ticket, a chat thread, a commit or analytics. The links live only in the `live_builds` table. Members get them only from the member query, and only when they are entitled.
- Links must be `https://` with no username or password in them. Anything else is refused with `INVALID_LINK`.
- Times are milliseconds since the epoch, in UTC. Members see them in their own time zone with the zone named.
- Durations are whole minutes, 15 to 240.
- Schedule the first session before founding offer window 1 opens (S7, S12).
- Every replay needs captions or a transcript before you add it (O8).

## What members see

| Status | When | Builder's Hub member | Free member |
|---|---|---|---|
| `scheduled` | More than 24 hours before the start | Title, time, summary. "The join link opens here 24 hours before the start." | Title, time, summary. "Join the live build" opens the upgrade sheet |
| `open` | From 24 hours before the start until the end | "Join the live build" link, once you have set one | Same as above |
| `ended` | After the end | "Watch the replay" link, once you have added one | "Watch the replay" opens the upgrade sheet |
| `canceled` | After you cancel | Not listed | Not listed |

Scheduled mutations flip the status at the right moments. You never set it by hand.

## Commands

Schedule a session. The join link is optional here. You can add it later.

```sh
npx convex run platform/liveBuildsOperator:create '{"title":"Build a waitlist app live","summary":"We build and ship one idea from the library in 90 minutes.","startsAt":1793811600000,"durationMin":90}'
```

Add or change the join link, the title, the summary or the time. A new time must be in the future.

```sh
npx convex run platform/liveBuildsOperator:update '{"id":"<live_builds id>","joinUrl":"https://<your meeting link>"}'
npx convex run platform/liveBuildsOperator:update '{"id":"<live_builds id>","startsAt":1793898000000}'
```

Clear the join link with `"joinUrl": null`.

Add the replay once it has captions or a transcript. It shows only after the session ends.

```sh
npx convex run platform/liveBuildsOperator:setReplay '{"id":"<live_builds id>","replayUrl":"https://<your replay link>"}'
```

Cancel a session. It disappears from the page. Then tell members about the make-up session or the one-month extension, as the Terms say (S9, O8).

```sh
npx convex run platform/liveBuildsOperator:cancel '{"id":"<live_builds id>"}'
```

Each command prints only the session id and its status, never a link.

## Missed month

If a month passes without a session, the Terms commitment (S9) is met by a make-up session or a one-month extension for every member. Pick one, record it as a ruling in `docs/wp/RULINGS.md`, and schedule the make-up session here if that is the choice.
