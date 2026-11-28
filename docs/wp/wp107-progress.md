# WP107 · Beehiiv account audience

Verified account creation already writes one durable sync job in Convex. The production inventory on 28 November found 71 jobs stopped before the provider call with `configuration_required`. The landing pages have their own Vercel configuration.

Use a dedicated string custom field named **Weekend MVP Account** with value **true**. Create a dynamic segment named **Weekend MVP Accounts** whose condition is that field equals true. Confirmed members of that segment are the audience for product emails. The existing landing-page acquisition source remains intact.

Configure the serving Convex deployment with the matching publication and API credentials plus `BEEHIIV_ACCOUNT_FIELD`. Configure `BEEHIIV_ACCOUNT_AUTOMATION_ID` only when the intended onboarding sequence is ready. New subscribers receive separate double opt-in confirmation. Existing active subscribers receive the account field. Pending subscribers keep their confirmation status, and suppressed subscribers are skipped.

For historical accounts, invoke the internal `accountBeehiiv:reconcileAccounts` with `{"paginationOpts":{"cursor":null,"numItems":25}}`, passing each returned continueCursor until isDone. Inspect counts before repeating with `apply:true`. Apply schedules one job per eligible account with a missing sync row or an exact configuration failure. A second pass leaves queued or completed jobs alone. Provider write uncertainties require review before replay.

Verification uses synthetic HTTP responses and Convex tests. Production activation and backfill require the owner to confirm the destination and confirmation email side effect.

The owner's subsequent email hold uses `BEEHIIV_ACCOUNT_MODE=existing_only` and the dedicated account field. Missing subscriber records stay in Convex with result `held_no_email`. Existing active or pending subscriptions get the matching subscriber tag and segment field. This mode ignores the account automation ID. It does not change a subscriber's status. Changing publication delivery rules or releasing held addresses is separate from activating this worker.
