# 07 — Landing design quality: how Leo avoids generic AI pages

Status: the C-ART change in §5 was approved by the owner on 2026-11-05 and merged as
WP69-S6 (#172), before G0. D23 is ruled (owner, 2026-11-05); D24 and D25 are ruled (owner, 2026-11-06).
Input: John's brief, `briefs/design-skills-crew-brief.md`. Where this doc
departs from it, §3 says why.

## 1. Where design quality is decided in our architecture

The hosted crew never writes HTML or CSS. Iris writes a `BrandKit`, and Leo
writes a `LandingSpec`. Both are structured data that the tenant renderer
(`app/site/[slug]`, WP75 S5) draws through a fixed set of section components
(`02` §9). That is a security rule (no generated script), and it also moves most
of the design quality out of the model:

| Layer | Who decides | When | What makes it slop |
|---|---|---|---|
| Section components, layouts, motion, browser surfaces | Our build agents and reviewers | Once, when we build the renderer (WP72, WP75 S5) | One template for every founder, so every page looks the same |
| Choices inside the components: direction, layout variant, type pair, palette, icons | Iris and Leo | Per business, at runtime | Free text that defaults to Inter, purple, centred hero, three cards |
| Copy | Iris (voice), Leo (page) | Per business, at runtime | "Unlock the power of", triads, generic claims |

So the brief's full skills go mostly to the **agents that build the
renderer**, not into Leo's prompt. At runtime Leo picks from options that are
each already good, and code checks the result.

## 2. The plan

**A. Build-time: a renderer that can't produce a generic page.**
- WP72 and WP75 S5 sub-agents load `impeccable` (craft floor), `design-taste-frontend`
  and `frontend-design` while they build the section components, and
  `ui-ux-pro-max` for palettes and type pairs. These skills are already
  installed on this machine.
- **Art directions:** the renderer ships about 6 of them, each a complete world of
  type pair, spacing, shape, surface treatment and one authored motion moment
  (rather than a colour swap). Examples: editorial, warm utility, bold
  geometric, quiet technical, hand-made, dense product. Each section has 2–3
  layout variants that are allowed per direction.
- **A CI gate over the whole matrix:** every direction × layout × 6 fixture brand
  kits (the spike businesses) is rendered with Playwright on desktop and mobile.
  Each render is checked with `impeccable detect`, axe (WCAG 2.1 AA) and the
  `@google/design.md` lint on the exported DESIGN.md. This runs in CI and in
  fixture mode, so it costs no model calls and needs no browser at runtime.

**B. Runtime: Iris and Leo choose from closed lists.**
- Iris gets candidates from the vendored UI/UX Pro Max data for the idea's
  product type: palettes, type pairs and a landing pattern. This is a
  deterministic lookup in TypeScript, put into the prompt before the call, so the
  model call has no tool loop. The candidates are filtered first through our
  bans (§4). Iris then locks a `visualSystem`: a direction, a type pair and
  shape and density tokens, alongside the existing palette and voice.
- Leo picks a layout variant per section from that direction's allowed list, and
  icons from a curated Phosphor set. The section copy follows the brand voice.
- **Deterministic checks after each generation (WP75 S4):**
  - AA contrast (already in C-ART);
  - every enum valid for the chosen direction;
  - a copy-slop lexicon (banned phrases, triads, "revolutionize", em-dash
    stacks);
  - heading lengths against the display limits;
  - no eyebrow.

  A failure triggers one repair call, as the plan already allows.
- **Distinctiveness eval (WP71 evals harness):** across the fixture businesses,
  no two share the same direction, type pair and palette family unless the
  ideas really are alike. An Opus rubric judge looks at the rendered
  screenshot, offline in evals only, and asks: "Would a designer take this for
  a template?" Live spend for evals still needs the owner's OK.

**C. Hand-off: the founder's coding agent keeps the look.**
- The brand kit exports deterministically to a DESIGN.md file (Google Labs
  format, Apache-2.0) that is stored with the business.
- Build pack prompts (Kai) reference that DESIGN.md. They also tell the
  founder's agent to install `frontend-design`, `impeccable` and
  `design-taste-frontend` and to run a Playwright screenshot-and-fix pass. GSAP
  skills are included only for the founder's own product. Skills are not
  outside services, so the 3-service cap in weekend prompt standard v1 is
  unaffected.

## 3. Where this departs from the brief, and why

| Brief | Here | Why |
|---|---|---|
| Thin tools `design.proMax.search`, `design.impeccable.detect` called by the crew | Pro Max data vendored and queried in TypeScript before the call; `impeccable detect` runs in CI over the renderer | Convex actions can't run the Python script or a browser. A tool loop also makes cost unbounded, and C-METER reserves a worst case per call. Leo's output is data, so a detector only adds value where HTML exists, which is our renderer, and it only needs to run once per variant |
| Anti-slop A: live `web.fetch` of design references | A curated reference shelf: our own rendered directions plus written notes. No live fetch at runtime | Live fetches add cost, prompt injection from page text, and copyright risk from copying a real site. VoltAgent's DESIGN.md files stay as reading for us, never shown to a founder |
| GSAP motion notes on the LandingSpec | Tenant pages use CSS-only motion: one authored moment per direction, honouring `prefers-reduced-motion`. GSAP only in the founder's build pack | No JS bundle on tenant pages. GSAP's licence bans "tools that allow users to build visual animations without code" that compete with Webflow; AI-written GSAP code is explicitly allowed (gsap.com/standard-license FAQ, checked 2026-11-05). We must never ship a founder-facing animation editor built on GSAP |
| icon-set-generator rules; Kubai | Curated Phosphor icon list (MIT) as an enum. Custom icon sets are deferred | Generating per-business SVG costs money and quality is unverified. A drawn library in one stroke weight already meets the craft floor |
| P1 skills (jakub, Emil, svg-foundry, screenshot-to-code, Figma) | Used by our build agents when relevant; not wired into the crew | They are useful to people writing code, not to an agent that writes data |

Kept as written: Pro Max for the visual lock, the Impeccable craft floor as the
quality bar, DESIGN.md as the Brand Book export, and the build pack stack. The
"never three full SKILL dumps in one prompt" rule stands, and the defer list is
unchanged.

## 4. Bans enforced by the contract and checks

From the Impeccable craft floor, adopted for founder pages:
- **Never:** an eyebrow or kicker above a heading; gradient text; emoji or Unicode
  glyphs as icons; a system font as the display face.
- **Not available as a section structure:** same-size icon + heading + text cards
  as the main section; a hero-metric template; 01/02/03 numbering, except
  in "How it works", where the order carries meaning.
- **Not available in the type list:** the overused defaults as display faces
  (Inter, Roboto, Open Sans, Arial, Poppins, Montserrat). The type list holds
  only self-hostable faces under the OFL, checked against Pro Max's
  `google-font-licenses.json`.
- **Light or dark:** set by the use scene in the direction, not by the category.
- **Browser surfaces are themed in every direction:** selection, caret, focus
  ring, underline offset and scrollbar.

These bans apply to founder pages only. The Weekend MVP site keeps its own
eyebrows and section numbers. That resolves the brief's conflict 2.

## 5. Contract change needed before G0 (WP69, PR #168)

C-ART today has three of the patterns above. It is cheaper to fix them before
the freeze than to migrate stored artifacts later:

1. `landingSpec.hero.eyebrow`: remove.
2. `brandKit.type.heading/body.family`: free text that the renderer can't load
   for arbitrary fonts. Replace it with a `typePair` enum from a curated list.
   Keep `notes`.
3. `landingSpec.promises`: three icon+text cards with a free lucide `icon` string.
   Replace the free string with a curated Phosphor icon enum, and add a `layout`
   enum so the renderer can draw it as a list, a split or a feature row, not
   only as cards.
4. Add to `brandKit` a `visualSystem` field holding `direction`, `shape` (radius)
   and `density`, plus `theme` (light or dark, with a one-line reason).
5. Add to `landingSpec` a `layout` enum for each section, with one rule: it must
   be allowed by the brand kit's direction. The landing schema can't see the brand
   kit, so the rule is a separate pure check, `checkLandingAgainstBrandKit(spec, kit)`.
   **WP75 S4 owns wiring it in**: it runs after every landing generation, and any
   issue it finds triggers the single repair call. Until then, nothing calls it.

The enum values start small and can grow; adding a value later is a widening
that needs no migration. Grammar size is tested against the per-schema ceilings.
As built (2026-11-05): landing_spec is 6,622 of 7,000 B. That leaves little room:
about 30 more icons would break the ceiling, so a larger icon list needs a smaller
schema elsewhere first. brand_kit is about 5,000 B; its ceiling was raised from
5,000 to 5,500 B, still far under the smallest live rejection of 8,288 B.

As built, these changes go beyond the list above:
- The heading weight comes from the type pair, not from the model.
- Theme mode must match the palette's ground and ink luminance.
- Emoji and leading section numbers are rejected in landing text.
- `typePairBrief()` gives prompts the list of pairs allowed for each direction.
These are breaking changes at `schemaVersion: 1`. That is fine before G0, because
no brand kit or landing spec has been stored anywhere yet; spike outputs live only
in the scratchpad.

Owners: WP69 amends C-ART. WP72 and WP75 S5 build the directions and the CI
matrix. WP71 adds the distinctiveness eval. WP75 S3–S4 add the Pro Max lookup,
the copy lexicon and the DESIGN.md export.

## 6. Rulings (owner)

- **D23 (ruled 2026-11-05):** the hosted crew uses no model tool loops in Phase A. Skills reach it as
  vendored data and deterministic checks. Full skills are for build agents and
  the founder's build pack.
- **D24 (ruled 2026-11-06):** founder pages follow the bans in §4, enforced by C-ART enums and CI.
  The Weekend MVP site is exempt.
- **D25 (ruled 2026-11-06):** tenant-page motion is CSS-only. GSAP is limited to the founder's own
  code through the build pack. No user-facing animation builder.

## 7. Licences (checked 2026-11-05 via the GitHub API)

| Source | Licence | Use here |
|---|---|---|
| UI/UX Pro Max | MIT | Vendor data, with attribution |
| Impeccable | Apache-2.0 | Detector in CI; craft floor as our rule source (NOTICE kept) |
| Taste Skill | MIT | Build agents and the build pack |
| Anthropic frontend-design | Apache-2.0 (file in the skill folder) | Build agents and the build pack |
| Google DESIGN.md | Apache-2.0 | Export format and lint |
| GSAP and gsap-skills | GSAP Standard License; skills MIT | See D25 |
| Phosphor icons | MIT (via Pro Max upstream data) | Curated enum on the renderer |
| Vercel web-design-guidelines | No licence file in the repo | Link only; don't vendor |
