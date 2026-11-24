# WP93 C1 — Owner spend alerts

- The existing cron checks today and yesterday. Its threshold flags and audit rows commit together.
- The Resend component applies its latest configuration to the entire queue. Owner mail needs a separate named mount to keep its sender credentials and retry policy isolated from tenant mail.

- Each newly due day, pool and threshold schedules one internal action. Its input includes the spent, in-flight and budget values at detection. Enqueue resolves the sole current binding in the same transaction that queues the email. The founder email kill switch does not affect this path.
- Each notification outcome appends an `ops.spend.notification` event whose subject ID is the original `ops.spend.threshold` event. Its metadata carries the day, threshold and outcome. A queued notification also records the Resend email ID, which identifies the component's eventual provider status or error. Missing or ambiguous bindings and missing account email are recorded without a recipient address.
- Owner mail uses the existing `AUTH_RESEND_KEY` and `AUTH_RESEND_FROM` configuration. A failed enqueue is retried once after 30 seconds. After a successful enqueue, the component makes at most two provider attempts using its own idempotency key. Repeated enqueue of the same alarm ID returns the existing email.
- Verified in an isolated localhost backend with Convex codegen, and in convex-test with the real Resend and workpool components and mocked HTTP. The provider tests exercise a successful send, a transient failure followed by success, and a repeated failure stored in component status.
- App and Convex typechecks, full test suite, lint, Next build, server traces and whitespace checks passed locally. ESLint reported 45 existing warnings. The suite skipped its CI-only base-ref check. Next showed a dependency advisory on the first build and passed on retry.
