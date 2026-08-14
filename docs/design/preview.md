# Preview contract (customisation)

Status: **accepted product thinking** (2026-08-14). Not implemented.
Branch: `design/platform-experience`.
Visual spec: [`preview-wireframe.html`](./preview-wireframe.html).
Companions: [`signed-in-home.md`](./signed-in-home.md) (last explicit keep, Day 1 canvas), [`signed-in-library.md`](./signed-in-library.md) (Preview then leave).

Supersedes, for **preview customisation only**: the `/build/{slug}` CMS (`BuildPreviewForm` — template picker + headline/benefits/CTA), and the brief’s “short idea-prefilled customisation step” as a form in front of the artifact. Does **not** waive preview isolation, 7-day capability, `noindex`, inert lead CTA, claim-only exclusivity, or structured rendering (no raw visitor HTML).

Do not implement this file as a work package until a later build pass.

## Job

Show me this idea as a page. Stamp my name on it if I have one. Don’t make me write the landing page first.

Customisation is **identity**, not copywriting. The page they stamp already looks like a real site.

## Artifact

A **per-idea compiled page**, not three generic skins with swapped copy, and not a unique LLM page per click.

| Layer | Law |
|---|---|
| Shared landing system | A small library of Aura-harvested `DESIGN.md` directions (type, color, spacing, motion, section rhythm). Five to eight is enough. Editorial, in the repo. |
| Per-idea brief | Optional. Which direction, which research proof, what this page is (waitlist vs calculator vs funnel). |
| Compile | Agent (or human) at **idea publish**, or lazy-once per slug. Inputs: idea + research snapshot + matching `DESIGN.md`. Output: frozen `pageSpec` (allowlisted blocks + tokens). Taste pass is ours. |
| Serve | Structured renderer. Aura HTML is a **compile reference**, never the served artifact. No `dangerouslySetInnerHTML` from a model. |
| Hot path | No model. Mint a capability onto the compiled spec. Stamp overlays copy only. |
| Fallback | Idea with no `pageSpec`: default composition + default `DESIGN.md`. Compile gap is editorial, not a visitor spinner. |

The 2026-08-06 three-template picker **dies for the visitor**. Three skins may remain as fallback when no `pageSpec` exists. Visitor does not choose Editorial / Product / Minimal.

## Hosted like a site (Polsia conversion)

The wow is a page in the URL bar, not an app form.

- **Wanted:** a preview host that is not the live tenant, e.g. `abandoned-cart-p7k.weekendmvp.app` → Keep/pay → `abandoned-cart.weekendmvp.app`.
- Preview host: `noindex`, watermarked, 7-day token, no leads, **not** a claimable customer slug. `preview` stays reserved.
- Wildcard DNS / extra preview hosts are **WP31-adjacent**. Until then, isolated `/preview/{token}` (already no marketing nav) is the fallback. Product freeze still names the host as the conversion; do not ship a fake subdomain in the UI.
- `/build/{slug}` remains the **mint URL** so public CTAs don’t break. It must not look like a page. Rate-limit the mint. On failure, a thin error — no CMS.

## Arrivals

Signup never lands on `/build`. “Preview this idea” mints and puts them on the site.

| Frame | Came from | What they see | After |
|---|---|---|---|
| **First look** | Public idea CTA, anonymous | Full-bleed compiled page. One honest preview mark. Identity overlay empty. **Keep this site.** | Keep = last explicit keep → sign-in `claimPreview`. |
| **Stamp** | Same page | One field: brand / shop / offer. Restamps copy. Does not rebuild `pageSpec`. | Still the preview. Then keep. |
| **Signed-in Preview** | Library, or public while authed | Same page. No “create an account” bar. | Claim → home Day 1. Missing stamp = first proposal, not a return to `/build`. |
| **Already building** | `/build/{slug}` anyway | Don’t mint a second preview. | Open that project. |

Viewing ≠ choosing. A token they didn’t keep is not a keep.

Copy changes after keep are Day 1 proposals / Day n diffs — not this surface.

## Chrome

Anonymous preview: **no product chrome, no marketing chrome.** The site is the chrome. URL bar is the host (or `/preview/{token}`).

One readable preview signal + optional decorative watermark. Do not stack notice banner + giant PREVIEW word + claim sermon. Keep button is the conversion; one short line is enough.

Page CTA stays inert (no leads).

Ghost “not this”: research (anonymous) or Library (signed-in).

Signed-in Day 1 after claim is home’s canvas + proposal rail, not a second preview app.

## Kill list

- `BuildPreviewForm`: layout picker, headline, subhead, problem, benefits, button copy, “Build my preview”
- `/build/{slug}` essay about adjusting wording
- Visitor-chosen Editorial / Product / Minimal
- LLM wait / unique HTML per click / serving Aura export
- Regenerating `pageSpec` because they typed a shop name
- Sending them back to `/build` to edit copy
- Triple expiry copy
- Credits, billing, composer
- Email-me-a-link (not on this freeze; **Keep this site** is the keep)

## Build-later acceptance (when we leave thinking mode)

A later implementation fails the spec if any of these are true:

1. `/build/{slug}` is still a landing-page CMS in front of the preview.
2. First Preview click does not land on a full-bleed compiled page (or mint→redirect to one).
3. Identity stamp rebuilds the page or calls a model.
4. Visitor picks a generic template as the design.
5. Preview captures leads or uses marketing nav.
6. Signed-in Preview still asks them to create an account.
7. Tests pass by substring-matching `BuildPreviewForm` instead of rendering mint → site → stamp → Keep.

Walk the wireframe. Taste is the gate. A preview that looks like the three zinc skins still fails even if the form is gone.

Compile quality (Aura `DESIGN.md` library, first `pageSpec`s, preview host DNS) is a later build/ruling. This freeze locks the **job and the door**.

## Out of scope (this freeze)

Publish packet is frozen separately: [`publish.md`](./publish.md). Account menu. Exact preview-host naming and WP31 DNS. How many `DESIGN.md` files and who runs the first compile. Day 1 proposal copy. Own-idea path (v1.1). Coding.

## Decision log

| When | Decision |
|---|---|
| 2026-08-14 | Customisation is identity, not copywriting. |
| 2026-08-14 | Artifact = per-idea compiled page (research + Aura `DESIGN.md`), claimable. |
| 2026-08-14 | No model on the hot path. Aura HTML is compile reference only. |
| 2026-08-14 | Stamp on the live preview, not a door form. |
| 2026-08-14 | `/build/{slug}` mints and redirects; it is not a page. |
| 2026-08-14 | Keep this site is the anonymous keep. No email-me-a-link in this freeze. |
| 2026-08-14 | Preview host is the Polsia conversion; `/preview/{token}` until WP31. |
| 2026-08-14 | Visitor template picker dies. Three skins may fallback when no `pageSpec`. |
| 2026-08-14 | Missing stamp after signup = Day 1 proposal, not `/build`. |
