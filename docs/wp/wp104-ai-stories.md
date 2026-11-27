# WP104 · Enhance with AI

## PR A · Panel and guarded preview contract

- Mount Enhance at `/admin/pages/enhance` with the existing operator check. Keep the Keystatic catch-all and its OAuth paths intact.
- Reuse the page singleton schemas to offer section-level editorial fields. Preserve structure, identifiers, live tokens, fixed language and code-owned values.
- Support adding optional editorial notes and checklists to the homepage. Leave the original rendered section sequence intact when the optional list is empty.
- Exercise the before/after contract with fixture responses. Keep model calls and writes outside this slice.

## PR B · Generate

- Connect one provider behind server authorization and rate limiting. Show a usage estimate before generation and usage after it. An absent user key stops the request before it contacts a provider.
- Generate returns a validated proposal without writing content.

## PR C · Approve

- Revalidate a proposal against the current baseline and the selected destination. Save locally or to a `content/` branch using the user's editor session. Reject stale input and all attempts to address the default branch.
