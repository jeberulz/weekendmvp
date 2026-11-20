# WP96 policy drafts: privacy section and terms section

Draft for the owner's review. Not legal advice. Nothing here is live: the pages `app/(marketing)/privacy-policy/page.tsx` and `app/(marketing)/terms/page.tsx` are not changed. The owner approves every word before it moves into `lib/legal/content.ts` or a page.

How to read the marks:

- `[CODE: file]` the statement is true of the code today. The file is the proof.
- `[UNCONFIRMED]` the code, docs or env do not show it. Confirm it, or delete the sentence, before publishing.
- `[OWNER]` a choice or a legal point only the owner can make.
- Text in `{{double braces}}` is a placeholder.

Facts come from `docs/wp/wp96-data-map.md` (read it next to this file). The deletion behaviour described is what `convex/account/deletion.ts` does.

---

## Part A. Draft privacy section: "AI, your business data and deleting your account"

This would sit next to the existing "Builder's Hub" privacy section (`PRIVACY_MEMBERSHIP` in `lib/legal/content.ts`).

### A1. What we collect when you build a business with us

When you use the workspace we store what you type and what the AI crew writes for you: your business idea, your answers in the setup steps, the name you pick, your chat with your co-founder (Wren), the notes Wren keeps about your business, and the documents the crew produces (blueprint, brand kit, emails, social posts, landing page). Each business is private to your account. `[CODE: convex/schema/workspace.ts, convex/platform/authz.ts]` We do not read your businesses as part of normal running. `[OWNER: confirm; the code has no staff read path for founder data, but operators with deployment access can read the database. RULINGS 2026-08-05 says there is no support bypass in the product.]`

### A2. AI processing and who processes it

To write your drafts and answer your chat we send text to an AI provider, Anthropic (its Claude models). `[CODE: convex/ai/router.ts, convex/ai/providers/anthropic.ts]`

What goes in a request, depending on the step `[CODE: convex/workspace/chat.ts, lib/workspace/crew/inputs.ts, lib/workspace/crew/context.ts]`:

- your chat message and your last 12 chat messages;
- your business name, your idea text, your answers (platform, pricing model, goal, the name you chose and the alternatives, the notes you added when you kept or edited a suggestion), your co-founder's name and style;
- the notes Wren keeps about your business, and the list of items waiting for your approval;
- for later steps, the blueprint and brand kit we already wrote for you;
- when you ask for changes, your change note and the earlier draft.

We keep a copy of the model's reply as your document or chat message. We keep a usage record (model, number of tokens, cost, time) that holds no text of your prompts or replies. `[CODE: convex/admin/aiCosts.ts, convex/schema/ai.ts]`

Anthropic keeps the business details from a request in a short-lived cache for about five minutes to make repeat requests cheaper. `[CODE: convex/ai/providers/anthropic.ts, convex/ai/gateway.ts]`

Anthropic's own retention of requests and replies, whether it uses them to train models, and whether we have a zero-retention setting: `[UNCONFIRMED]` Nothing in the code, docs or env shows a retention or training setting. `[OWNER: check the Anthropic account terms and settings, then replace this paragraph with the real answer. Do not publish "we do not train on your data" until that is confirmed.]`

The AI does not take actions for you. It can only propose a card that you approve or decline. Nothing is sent, posted or published without your approval. `[CODE: convex/workspace/approvals.ts; RULINGS 2026-11-05 D13]`

AI makes mistakes. It can write things that are wrong, out of date or too similar to something else. You must check what it writes before you use it.

Other companies that handle your data for us `[CODE unless marked]`:

| Company | What for | What it gets |
|---|---|---|
| Anthropic | AI drafts and chat | the text above |
| Convex | our database and backend (production region eu-west-1) `[CODE: convex/editorial/readerTarget.ts]` | everything stored in your account |
| Vercel | hosting the website | requests and logs `[UNCONFIRMED: log retention and function region]` |
| Resend | sign-in emails | your email address and the sign-in link |
| Stripe and Link | paying for Builder's Hub | already described in the Builder's Hub section |
| Beehiiv | newsletter and onboarding emails | your email address; see below |
| Google | sign-in with Google, and analytics if you accept cookies | profile name, email and picture at sign-in; page views after consent |
| Meta | the ad pixel, only if you accept the analytics cookie `[CODE: components/consent/AnalyticsScripts.tsx]` | page views and some events |

`[OWNER: the live policy names only Google Analytics, Beehiiv, Stripe and Luma. The rows for Anthropic, Convex, Vercel, Resend, Google sign-in and Meta are missing there today.]`

Image providers (OpenAI Images, Recraft): the code can call them but nothing calls them for founder content today. `[CODE: convex/ai/gateway.ts `runImageGateway` has no caller]` Add them to the table only when founder images ship. Research providers (OpenAI, Perplexity, DataForSEO) are used on public idea research by us, not on your data. `[CODE: lib/engine/providers/]`

### A3. How long we keep data

| Data | How long | Basis |
|---|---|---|
| Your account, businesses and everything in them | Until you delete your account. No automatic expiry. `[CODE: no TTL or purge job exists for these tables; docs/wp/wp96-data-map.md section 5]` | |
| Sign-in session | 30 days from sign-in or 30 days idle `[UNCONFIRMED: library defaults, no override found; confirm Convex env]` | |
| Sign-in link | 1 hour `[CODE: convex/resendMagicLink.ts]` | |
| Anonymous landing-page preview | Link works for 7 days. `[CODE: convex/platform/preview/capabilities.ts]` Expired rows are not purged by any job today, so they stay in the database. `[OWNER: either add a purge (a Codex need) or do not say the preview is deleted after 7 days.]` | |
| AI usage records | Kept after you delete your account, with no text in them, so our cost totals stay correct. `[CODE: convex/account/deletion.ts]` `[OWNER: set a period, or say "for as long as we need our accounts"]` | |
| Payment and plan records (Stripe ids, orders, credit ledger) | Kept after deletion. `[CODE]` Stripe and Link keep what they hold under their own policies. `[OWNER: choose a retention period and the legal reason. UK tax records are commonly kept for six years; confirm with an accountant before publishing a number.]` | |
| Activity log (what happened and when) | Kept after deletion, with free-text details removed. `[CODE: convex/account/deletion.ts]` `[OWNER: same as above]` | |
| Newsletter list copy in our database | Deleted when you delete your account. `[CODE]` Beehiiv keeps its own copy until you unsubscribe or ask for removal. `[UNCONFIRMED: Beehiiv retention and deletion handling; the deletion button does not contact Beehiiv]` | |
| Emails sent through Resend | Resend's retention applies: up to 30 days in the US for the tenant mail case in RULINGS 2026-11-06. `[UNCONFIRMED for sign-in mail]` | |
| Visitor emails collected by your landing page | Today the page stores test rows only. `[CODE: convex/platform/sites/leads.ts]` Real visitor capture needs the D5 notice, retention and export first. `[OWNER: RULINGS 2026-11-05 D5 says deleted 30 days after you delete the business or close the account. The deletion button removes them at once instead. Say which you want.]` | |
| Cookie choice | 365 days `[CODE: components/consent/ConsentProvider.tsx]` | |
| Backups | `[UNCONFIRMED]` Convex backup retention, and operator database snapshots saved on a laptop on 2026-10-04 `[CODE: docs/wp/backup-restore.md]`. Deleted data can remain in backups until they expire. `[OWNER: decide whether to say so, and confirm the snapshots are deleted or encrypted.]` | |

### A4. Deleting your account and data

You can delete your account yourself: Settings, then "Delete account", then type DELETE. `[CODE: app/dashboard/settings/DeleteAccountSection.tsx]`

When you do:

- You are signed out at once and can't sign back in to that account. Your name, email and sign-in records are removed immediately. `[CODE]`
- Within a few minutes, usually less, we delete every business you own and everything in it (documents, chat, approvals, memory, files, sites and email data), plus your saved ideas, notes, collections, plans, setup answers and wizard answers. `[CODE: convex/account/purge.ts]`
- Ideas you suggested to the public list stay as text without your identity, and your votes are removed. `[CODE]` `[OWNER: confirm you want the text to stay.]`
- We keep, without your details: AI usage and cost records, payment and plan records, and a log that the deletion happened. `[CODE]`
- It can't be undone.
- If you have a paid plan that still renews, you must cancel it first. Deleting your account does not cancel it. `[CODE: DELETION_BLOCKED, paid_subscription]` `[OWNER: lifetime members lose their seat on deletion; the 30-day refund rule is separate. Decide whether to warn lifetime members in the screen.]`
- Copies held by other companies (Anthropic's short cache, Resend, Stripe and Link, Beehiiv, Google and Meta analytics) are not removed by the button. Ask them, or us, if you want that. `[OWNER]`

If you can't sign in, email {{support email}} from the address on your account and ask us to delete it. We will reply within {{OWNER: number}} working days. `[OWNER: the live Terms promise a two-working-day reply for membership questions, RULINGS 2026-10-09. Reuse it or set a different time for privacy requests. The deletion code only starts from a signed-in session. There is no operator command that deletes an account for someone who can't sign in (owner question 7), so today a manual request is a hand job.]`

Old records that cannot be found by account today: legacy ship·able payment events (`stripe_events`), which hold an email address but have no email index. `[CODE: convex/schema.ts]` `[OWNER: decide whether to scrub them by script.]`

### A5. Your rights

`[OWNER: the existing policy has no section on data protection rights. If you serve people in the UK or EU you will need one: access, correction, deletion, objection, complaint to the regulator, the legal basis for each use, who the controller is, and any transfers outside the UK or EU (Anthropic, Vercel, Stripe, Resend, Beehiiv and Google are US companies; the transfer mechanism is `[UNCONFIRMED]`). This is a legal task, not a code task. WP96 does not draft it.]`

### A6. Cookies and analytics: corrections the owner should look at

These are gaps found while mapping, not part of the AI wording:

- The live policy says your cookie choice is kept in localStorage. It is also stored in a cookie of the same name. `[CODE: components/consent/ConsentProvider.tsx:50]`
- The "Analytics" switch covers Google Analytics and the Meta pixel; the policy names only Google. `[CODE: components/consent/AnalyticsScripts.tsx]`
- Workspace page addresses contain your business id (`/dashboard/b/<id>/...`). If you accept analytics, that path is sent to Google and Meta. Only preview links, sign-in callbacks and admin pages are excluded or redacted. `[CODE: components/consent/AnalyticsScripts.tsx, lib/analytics-redaction.ts]` `[OWNER: exclude /dashboard from analytics. That file is outside WP96 (lib/track.ts and consent code are WP95 or shared); raised as a follow-up.]`
- An affiliate script from Impact.com loads on every page, including the dashboard, with no consent check. `[CODE: app/layout.tsx:14]` `[OWNER: remove it, gate it behind consent, or name it in the policy.]`
- The legacy ship·able payment webhook writes the buyer's email to server logs. `[CODE: app/api/stripe-webhook/route.ts:75]`

---

## Part B. Draft terms section: "Using the beta and your AI-generated work"

The live Terms (`TERMS` in `lib/legal/content.ts`) cover Builder's Hub only. This is a new, separate section for the workspace, not an edit of those terms.

### B1. This is a beta

Weekend MVP's workspace is in an invite-only beta. It is early software.

- It may be wrong, slow, unavailable or changed without notice. We may reset, limit or remove features, and we may stop the beta.
- We give no promise of uptime, or that any AI output will be accurate, complete, lawful or fit for your purpose.
- We may limit or pause AI use (daily and lifetime spend limits apply to each account). `[CODE: convex/ai/metering.ts; RULINGS 2026-11-05 D3]`
- Don't put in anything you aren't allowed to share, and don't enter other people's personal data, health, financial or government identity data.
- You are responsible for what you publish, send or sell. Review every draft. We don't give legal, financial or tax advice, and the AI isn't a lawyer.
- Nothing is sent, posted or published for you without your approval. `[CODE]`
- Keep your own copies of anything you can't afford to lose.

`[OWNER: this must work with the consumer-rights and "Our responsibility to you" parts of the live Terms. A blanket "no responsibility" is not valid in the UK for consumers. Take legal advice on the wording; the live Terms were signed off by the owner without a lawyer, RULINGS 2026-10-09.]`

### B2. Who owns what the AI writes

Draft position, for the owner to accept or change `[OWNER]`:

- **Your inputs** (your idea, answers, messages) stay yours. You give us permission to store them, process them and send them to the processors listed in the privacy section, only to run the service for you.
- **Your outputs** (the documents, copy, names and pages the crew writes for your business): as between you and us, they are yours to use, including commercially. We claim no ownership of them.
- **No guarantee of protection or uniqueness.** AI output may not be protected by copyright, and the same or similar text can be produced for other people. For library ideas, the crew starts from a shared research seed for that idea, so other founders who build the same idea may get similar drafts. `[CODE: convex/crew/seeds.ts, lib/workspace/contracts/seeds.ts; RULINGS 2026-11-07 WP90]`
- **Third-party rights.** We don't promise outputs are free of third-party rights (copyright, trademark). Check names, logos and claims before you use them. The crew refuses fake testimonials, user counts and similar claims, but it is a check, not a guarantee. `[CODE: RULINGS 2026-11-05 D24; docs/plans/launch-workspace/02-architecture.md section 5.8]`
- **Our materials.** The Weekend MVP site, the idea research pages, our prompts and software stay ours.
- **Provider terms.** Our AI provider's terms say who owns outputs as between it and us. `[UNCONFIRMED: not in the repo. OWNER: read Anthropic's current commercial terms and confirm they let us pass ownership of outputs to you. If they don't, change the draft.]`

### B3. Deleting your account

You can delete your account at any time from Settings. What that removes and what we keep is in the privacy section. A paid plan that still renews has to be cancelled first, and deleting your account doesn't give a refund. `[OWNER: the refund policy is separate and unchanged, RULINGS 2026-10-09.]`

### B4. Contact for privacy and deletion requests

{{support email}}. `[OWNER: the live legal pages use iseghohi.john@gmail.com as the support address and say the registered company details are available by email, RULINGS 2026-10-09 and 2026-10-09 "legal pages live". Decide whether privacy requests go to that address or a new one.]`

---

## Owner questions (needs your answer)

1. **Ratify physical deletion.** `docs/wp/RULINGS.md` 2026-08-05 says v1 has no destructive deletion and audit records stay immutable. WP96 deletes founder data on request and removes the `metadata` text from the founder's audit rows. Add a ruling row to approve both.
2. **Audit rows.** Is removing only the `metadata` field enough? The rows keep the action, subject id, timestamp and the (now empty) user id.
3. **Financial and meter rows.** Keep payment, ledger and AI usage rows after deletion, with no text and no name? For how long?
4. **Anthropic.** What is the account's retention, training and zero-retention position? This decides the AI paragraph.
5. **Output ownership.** Accept B2 as written, or change it after reading the provider terms?
6. **`offer_cohorts` hashes.** The deletion does not touch them (an unsalted hash of the email, `convex/platform/membership/cohortHash.ts`). Delete a founder's hash when they delete their account, or keep it as an offer-eligibility record?
7. **Manual and stuck deletions.** There is no cron to restart a stopped chain and no operator command that runs the whole flow for someone who can't sign in. Do you want one? It would be a Codex need.
8. **Public idea suggestions.** Keep the text of a deleted founder's public suggestions, without their identity, as the code does now?
9. **Lifetime members and refunds.** Warn lifetime members that deleting the account ends the seat, and say whether the 30-day refund still applies?
10. **Leads.** Delete founders' visitor emails at once on account deletion (code today), or keep the D5 30-day timer?
11. **Analytics.** Exclude `/dashboard` from analytics, gate or remove the Impact script, and name Meta and Impact in the policy? These touch files outside WP96.
12. **Rights, controller and transfers.** Who writes the data-protection-rights section and the international-transfer wording?
13. **Backups.** Say that deleted data can stay in backups for a period, and where the 2026-10-04 snapshots are now.
14. **Newsletter and Beehiiv.** Add a Beehiiv removal call to the deletion flow, or leave it as a manual step and say so?
