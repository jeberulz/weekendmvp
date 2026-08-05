# Weekly validation digest

The scheduled workflow runs every Monday at 08:00 UTC. It compares the last
seven complete UTC days with the preceding 28 days, writes a Markdown artifact,
and sends the same report through Resend.

## GitHub Actions secrets

Configure these repository secrets:

| Secret                         | Value                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `GA4_SERVICE_ACCOUNT_JSON`     | Complete Google service-account JSON document                                          |
| `RESEND_API_KEY`               | Resend API key with send access                                                        |
| `VALIDATION_REPORT_EMAIL_FROM` | Sender on a verified Resend domain, for example `Weekend MVP <reports@weekendmvp.app>` |
| `VALIDATION_REPORT_EMAIL_TO`   | Owner recipient address; comma-separate multiple recipients                            |

The service account must have at least Viewer access to GA4 property
`517826359`. The workflow does not need GA4 custom dimensions: it groups events
by the built-in `pagePath` dimension and uses manifest metadata to resolve idea
slugs and primary actions.

Do not commit credentials or the recipient address. The workflow fails when an
email secret is missing so an artifact-only run cannot be mistaken for a
delivered report.

## Manual run

Use **Actions → Weekly validation digest → Run workflow**. Successful runs:

1. query GA4 twice (current and baseline periods);
2. create `reports/validation/YYYY-MM-DD.md`;
3. send the report through Resend using a date-based idempotency key;
4. upload the Markdown artifact for 30 days.

## Local run

Application Default Credentials:

```bash
GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/gsc/service-account.json" \
  npm run validation:digest -- --stdout
```

Explicit JSON and email delivery:

```bash
GA4_SERVICE_ACCOUNT_JSON="$(<"$HOME/.config/gsc/service-account.json")" \
RESEND_API_KEY="re_..." \
VALIDATION_REPORT_EMAIL_FROM="Weekend MVP <reports@weekendmvp.app>" \
VALIDATION_REPORT_EMAIL_TO="owner@example.com" \
  npm run validation:digest -- --email --stdout
```

## Interpretation

Page-level signals require at least 25 views in the current seven-day period
and 100 views in the 28-day baseline. The report flags:

- at least 25% movement in current views versus the baseline weekly average; or
- at least 2.0 percentage points of movement in primary-action conversion.

Historical ideas default to `idea_prompt_copied`. New ideas declare their
audience, falsifiable hypothesis, and primary action in
`ideas/manifest.json.validation`.
