# L1 beta: Wren chat, fixture replies and live readiness (2026-11-07)

Lane: Small Fix (branch `claude/l1-wren-chat-afc1be`). Owner report: every Wren
reply on the local backend was the word "fixture".

## Cause (confirmed)

The chat is built (WP77). The local backend runs in fixture mode, because
`convex/ai/providers/mode.ts` treats anything other than
`AI_PROVIDER_MODE=live` as fixture. In fixture mode the Claude adapter uses
`createFixtureAnthropicClient`. That client looks for a registered fixture
output (`fixtureOutputs.ts`, by prompt ref, then by C-ART schema). Wren's two
chat prompts (`wren-chat@3`, `wren-plan-turn@3`) had none, so the client fell
back to `sampleFromJsonSchema(wrenReplyOutput)`, which gives
`{"reply":"fixture"}`. The rest of the path works: send, gateway, meter,
stream, `finishWrenTurn` and the thread. It stored and showed that reply
exactly as it would a real one.

## What changed

- `convex/ai/providers/wrenFixtureReply.ts` (new). Builds a deterministic Wren
  reply from the request the gateway sent: the founder's message (from
  `<founder_message>`) and the business context (name, open reviews,
  approvable things). No env, network or clock. Only `fixtureOutputs.ts`
  imports it, and the test checks that import edge.
  - "What needs my approval?" lists the open reviews and where to review each
    one. It also proposes approval cards for each approvable thing, up to
    `WREN_CARDS_PER_TURN`. The server checks those cards like any model
    proposal.
  - Greetings, "what's next" questions and plan turns each get their own
    short reply.
  - Anything else gets a quote of the message and an honest line saying it
    needs the live model, plus where the business stands.
  - Every reply ends "Test mode: no AI model wrote this reply.", so a fixture
    reply is never mistaken for the model. It never writes memory.
- `fixtureOutputs.ts`: `FixtureOutput` now receives the request. Both Wren
  refs are registered.
- `fixtures.ts`: the plain-text fixture reply is now "Test mode: no AI model
  wrote this reply." instead of "Fixture reply: …".
- `convex/workspace/chat.ts` changes **the live prompt's data as well**. Wren's
  business context now carries `waitingOnYou`: the crew's open
  `artifact_review` cards, from the same set as Team HQ's "Waiting on you"
  (cards past their seven days are left out).
  Each entry has a title and a review page, and no approval ids. Before this,
  live Wren could not see those reviews, so "What needs my approval?" right
  after launch would have said nothing was waiting. The prompt specs are
  unchanged, so no version bump was needed.
- Chat avatars:
  - Wren's generated crew-lead portrait (`/image/crew/lead-wren.webp`) shows
    in the chat header and on each Wren message. A renamed partner keeps the
    portrait.
  - The founder's initial shows beside each of their messages. It uses the
    sidebar user row's sky circle, with a person icon when there is no name.
  - Both are decorative (`aria-hidden`); the name is written next to each.

## Live readiness (code reading and tests, no live call)

Nothing found blocks Wren in production once John sets these on the
**production Convex deployment** (Convex env, not Vercel; Convex never reads
`.env.local`):

- `AI_PROVIDER_MODE=live` exactly. `LIVE`, ` live` or `true` stay fixture.
- `ANTHROPIC_API_KEY`. With live mode on and no key, every turn fails
  `config` before anything is sent, and the founder sees "Wren couldn't finish
  this reply."

Checked:

- Prompt and context:
  - `wren-chat@3` runs on Haiku (`claude-haiku-5-5`). `wren-plan-turn@3` runs
    on Sonnet (`claude-sonnet-5-5`), at most 5 times per business per day.
  - The context carries the business, partner, memory, approvable things and
    now the open reviews. Founder text is quoted as JSON data.
  - There is **no brand-kit summary or blueprint** in Wren's context.
    Questions about the brand or blueprint get answers from the idea text
    only. That is a possible follow-up, not a blocker.
- Streaming: `messages.stream`, `partialReplyText` and throttled
  `writeWrenDraft`. The SDK-shaped stream that breaks mid-reply is covered in
  `chat.test.ts` (it ends `failed` and charges the worst case). "Try again"
  reuses the founder message, does not count against the cap, and is capped
  at `WREN_MAX_ATTEMPTS_PER_MESSAGE`. A reply stuck in streaming is failed
  after `WREN_STREAM_STALE_MS`.
- Gates:
  - The `ai` kill switch gives the "paused" result with no row and no spend.
  - `wrenFree` allows 40 messages a day per owner (fixed window). Over the cap
    the founder sees the tomorrow card.
  - The meter checks the global daily budget (set it to $10:
    `globalDailyBudgetMicroUsd = 10_000_000n`), the per-owner daily cap ($1
    free, $5 paid) and the **Free lifetime ceiling of $1.50** (D3), which
    covers Free work that is not credit-funded.
- Cards:
  - Approval cards: publish (site version), send (draft sequence), post
    (copy-ready social post). Each one is server-checked against the business.
  - Explain and navigate cards are validated and then **dropped** until
    `chat_messages.cards` lands (Needs from Codex #13). The prompt already
    tells the model not to refer to them.
  - Crew `artifact_review` cards cannot be attached from chat by design. Wren
    names them and the page instead.

Things to watch, none a blocker:

1. **Free lifetime ceiling.** A Free beta tester's own non-credit AI spend is
   capped at $1.50 for life, and Wren chat counts toward it. When it is
   reached, Wren replies with the `budget` line, "…today's AI budget… Try
   again tomorrow", which is wrong for a lifetime cap. Confirm the beta
   testers' plan, or raise the ceiling for the beta. The copy fix belongs in
   `lib/workspace/wren.ts` (`WREN_FAILURE_COPY.budget`). Telling `daily` from
   `lifetime` needs the meter's refusal scope passed through (Codex:
   `convex/ai/metering.ts`).
2. `WREN_FAILURE_COPY` says "Wren" even when the founder renamed the
   partner. This is cosmetic.
3. After the deploy, send one message on production. If the reply ends "Test
   mode: no AI model wrote this reply.", `AI_PROVIDER_MODE` is not `live`
   there.
4. No cron schedules `expireStaleApprovals` (`convex/workspace/approvals.ts`),
   so pending cards past their seven days stay stored as `pending`. Wren
   leaves them out using the turn's own time (review on PR #274), the same
   way Team HQ hides them. Scheduling the expiry belongs in `convex/crons.ts`
   (Codex).
5. Sonnet cache-read pricing is flagged in `convex/ai/pricing.ts` to check
   against the live price page before spending. It can only over-charge.

## Live smoke test on the local backend (planned, not run)

Cost: one Haiku turn, about 3K input tokens (written to cache) and at most
about 300 output tokens. At the repo's rate card ($0.10 / $0.50 per MTok) that
is about **$0.0005**, a twentieth of a cent. The meter reserves at most about
$0.001. Send a plain question, not a plan change, so the turn stays on Haiku.

John runs these himself (the key is never typed into chat or read by an
agent):

1. From `.worktrees/local-fixture-test`, confirm the CLI targets the local
   anonymous deployment and not `first-squirrel-244`:
   `CONVEX_AGENT_MODE=anonymous npx convex dashboard --no-open` should print a
   local (`127.0.0.1`) URL for an `anonymous-…` deployment. Stop if it names
   `first-squirrel-244` or `weekendmvp-2a6d0`.
2. Copy the Anthropic key to the clipboard, then run
   `CONVEX_AGENT_MODE=anonymous npx convex env set ANTHROPIC_API_KEY "$(pbpaste)"`.
   The substitution keeps the key out of shell history.
3. `CONVEX_AGENT_MODE=anonymous npx convex env set AI_PROVIDER_MODE live`
4. At http://localhost:3188/dashboard/b/vh78925xprs4hsv91m3x7zyvhh8hrbfd,
   send Wren: "What needs my approval right now?"
5. Expected: the reply streams in, does **not** end with the "Test mode" line,
   and names the Blueprint review. It may carry the draft email sequence's
   approval card.
6. Check the spend: `CONVEX_AGENT_MODE=anonymous npx convex data ai_usage --limit 1 --order desc`.
   It should show `wren-chat@3`, `claude-haiku-5-5`, `settled`, with a cost
   well under 10,000 micro-USD.
7. Switch back to fixture:
   `CONVEX_AGENT_MODE=anonymous npx convex env remove AI_PROVIDER_MODE`, then
   `CONVEX_AGENT_MODE=anonymous npx convex env remove ANTHROPIC_API_KEY`

## Checks

`npm run typecheck`, `npm run test:platform` (2711), `npm run test:convex`
(1383), `npm run test:security`, the prompt version check, eslint on the
changed files, and `npm run build`. Browser check on the local fixture backend
for the approval question, a free-form message, the approval card and both
avatars. The a11y check passed: images are `alt=""` inside `aria-hidden`,
the founder initial has 7.06:1 contrast, and there are no new controls.

Docs updated: this file. No other docs needed.
