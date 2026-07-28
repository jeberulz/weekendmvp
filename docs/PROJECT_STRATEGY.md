# Project Strategy

This registry tracks active and completed work packages for Weekend MVP.

| WP | Title | Lane | Branch | Status | Definition of done |
| --- | --- | --- | --- | --- | --- |
| WP01 | Social video link hub | Work Package | `feat/wp01-links-hub` | Complete | `/links` renders only the current Europe/London campaign destination, advances automatically each day, links directly to the existing gated idea page, and passes the available configured checks. |
| WP02 | Released ideas archive | Work Package | `feat/wp02-links-archive` | Gate pending | `/links` features today's release and provides a cumulative, future-safe archive with audience categories, search, video-format filtering, and eight-item load-more pagination across all campaign calendars. |
| WP03 | Five AEO/SEO articles | Work Package | `cursor/publish-5-articles-aeo-seo-f2aa` | Complete | Five net-new articles in MDX + manifest, Convex-seeded (prod), OG cards generated (retry landed), FAQ-forward AEO structure and CTAs to `/startup-ideas`. |
| WP04 | Publish 5 programmatic SEO hubs | Work Package | `cursor/publish-5-programmatic-hubs-8e5e` | PR ready | Three audience hubs (`freelancers`, `creators`, `small-business-owners`) + two problem hubs (`lead-generation`, `content-creation`) in config, ideas tagged, typecheck green, PR open. Seed to prod pending Convex deploy credentials. |
| WP11 | Convex database I/O audit and safe fixes | Work Package | `feat/wp11-convex-performance-audit` | Complete | Hot Convex reads are traced end-to-end, safe indexed/bounded fixes preserve related-idea eligibility and ordering, local-only parity tests and project gates pass, and the audit documents expected monthly I/O below 250 MB without a migration. |
