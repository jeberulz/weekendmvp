# Gates

## preview-bridge-prod

- Status: open
- Question: Set PLATFORM_PREVIEW_BRIDGE_SECRET (>=32 chars) and PLATFORM_PREVIEW_APP_ORIGIN=https://www.weekendmvp.app on Vercel Production, then redeploy 80d6f27? Local .env.local already has a 64-char bridge secret. This unblocks anonymous preview generation. Not WP31 DNS/Stripe.
- Options: set-and-redeploy,wait
- Default: wait

## convex-auth-prod

- Status: open
- Question: Set Convex production AUTH_RESEND_KEY, SITE_URL=https://www.weekendmvp.app, and AUTH_RESEND_FROM so magic-link works? Local has AUTH_RESEND_KEY only. FROM and SITE_URL are absent locally. Needed for claim/signup after preview works. Read logs for request 404203ed681625d4 first if you want the exact missing var.
- Options: set-convex-auth,wait
- Default: wait
