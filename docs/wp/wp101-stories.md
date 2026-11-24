# WP101 — Leo’s private landing-page workflow

Gate: WP97’s live consultation retest passed on Balcony Relay QA after PR #322 deployed. Both calls used `crew-consultation@2` and confirmed the exact saved email CTA after refresh.

- S1. An owner can request a private landing draft by Leo after approval of the blueprint and Brand Kit. Use the existing crew queue, meter and task lineage. Record one genuine Iris handoff and give Leo her answer before composing the validated LandingSpec. Account for duplicate dispatch, timeouts and revisions.
- S2. Store the preview as a draft site version backed by the exact approved input documents. Add an owner-only synthetic waitlist action and a visible receipt. Test project scoping, version scoping, duplicate submits, and persisted results. The synthetic action uses the existing test lead representation.
- S3. Put the handoff, current task state and draft review in Team HQ and the private preview. Render through the existing brand-aware React components and let the owner test the waitlist in the preview.
- S4. Document how to research the brand and audience, choose a layout and licensed typography, direct visual assets, and review the rendered outcome. Keep the visual decisions in the brand and design brief and use external services only for bounded research or asset jobs.
- S5. Verify the workflow with fixture AI and localhost in desktop and mobile sizes. Record remaining provider and production rollout gates.
