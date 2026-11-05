# Weekend MVP — consolidated public design-skills brief

One catalogue for the crew skill pack (`convex/crew` + `convex/ai` prompt registry), design-phase gate before LandingSpec, and anti-slop loop (**refs → visual lock → self-check**). Covers caller asks (Impeccable, UI/UX Pro Max, icons, vectors, website animation / “G-Sub”) plus open-ended finds for landing composition, typography, color systems, accessibility, motion/interaction, screenshot-to-UI, and related quality levers.

**“G-Sub” verified:** **GSAP** (GreenSock). Official skills: [greensock/gsap-skills](https://github.com/greensock/gsap-skills). No public skill named “G-Sub.”

---

## Skill file vs link (default rule)

| Mode | Use when | What to vendor |
|---|---|---|
| **Thin pipeline tool** | Hosted Wren / Convex jobs | Pinned excerpt, rule IDs, or script wrapper — never paste full SKILL.md into every system prompt |
| **Full skill install** | Build pack, Cursor, Claude Code, WMVP Design agents | `npx skills add …` or copy into `~/.claude/skills` / project skills |
| **Link / drop-in file** | DESIGN.md, guideline docs, recipe indexes | Pin a snapshot in repo or Brand Book; fetch once then vendor |

**Default for WMVP:** thin tools + registry excerpts in Convex; full installs only on coding agents and the founder Build pack.

---

## Priority recommendation

| Tier | Skills | Where they live |
|---|---|---|
| **P0 — Phase A hosted crew** | UI/UX Pro Max, Impeccable (craft-floor + detect), icon-set-generator rules, short motion/a11y principles, DESIGN.md as VisualSystem export format | Iris lock → Leo compose → publish gate |
| **P0b — Build pack / Engineering employee** | Anthropic frontend-design, Taste Skill (`design-taste-frontend`), Vercel web-design-guidelines, GSAP skills, Playwright visual loop | Founder ships real product UI |
| **P1 — deepen craft** | jakubkrehel better-typography / better-colors / better-accessibility / better-interface; Emil design-eng; SVG Foundry; screenshot/image-to-code; VoltAgent awesome-design-md (reference only) | Coding agents + Brand Book |
| **Defer** | $50k / cinematic-scroll builders, glassmorphism packs, full Kubai+Sora+animated-svg stack at once | Wrong weight for weekend landing shell |

**Sequencing (do not dual-dump full skills into Leo):**  
Pro Max / Taste directions → lock VisualSystem (DESIGN.md-shaped) → Impeccable craft-floor in compose → detect + a11y checklist → (coding path) Taste/frontend-design generate → Playwright look → web-design-guidelines audit.

---

## Catalogue

### A. Core anti-slop & design intelligence

#### 1. UI/UX Pro Max
- **Location:** https://github.com/nextlevelbuilder/ui-ux-pro-max-skill · https://www.uupm.cc/ · on box: `~/.claude/skills/ui-ux-pro-max`
- **Need:** Full install on design agents (already done). Convex: **thin tool** `design.proMax.search` wrapping `scripts/search.py --design-system` (pin version).
- **One-liner:** Searchable local design intelligence — styles, 192 product palettes, fonts, landing patterns, 119 UX guidelines, Phosphor icons, GSAP presets, stacks.
- **Crew fit:** **Anti-slop B (visual lock)** — Iris cold-start for VisualSystem / Brand Book. Live web refs still required (A). Optional UX guideline IDs at self-check.

#### 2. Impeccable
- **Location:** https://github.com/pbakaus/impeccable · https://impeccable.style · local clone `/workspace/tweet-skills/impeccable/`
- **Need:** Vendor **craft-floor** rule list + `npx impeccable detect` as `design.impeccable.detect`. Full slash skill for Build pack only.
- **One-liner:** Craft-floor bans + critique/audit/polish + deterministic 62-rule detector against AI UI slop.
- **Crew fit:** **Anti-slop C–D** — Leo compose constraint + publish gate. Pin exception vs WMVP eyebrows / 01–02–03 templates or change templates.

#### 3. Taste Skill — `design-taste-frontend` *(landing composition / art direction)*
- **Location:** https://github.com/Leonxlnx/taste-skill · https://www.tasteskill.dev/
- **Need:** **Full install** on Build pack / coding agents (browser inspector needs Node 22+ + Chrome). Hosted crew: **compress anti-default bans + “one direction” idea** into Iris/Leo; do not run `inspect.mjs` inside Convex.
- **One-liner:** Art direction from ~247 curated sites — deals researched directions (type, palette, composition), enforces no-slop house style, screenshot look-and-fix in a real browser.
- **Crew fit:** Strongest **landing-composition** peer to frontend-design for Kai. Overlaps Impeccable + Anthropic — use Taste/frontend-design for *generation* on coding path; Impeccable detect for *gate* on hosted path. Filter Pro Max trendy styles through Taste/Impeccable bans before lock.

#### 4. Anthropic — frontend-design
- **Location:** https://github.com/anthropics/skills/tree/main/skills/frontend-design
- **Need:** Full skill on Build pack / WMVP Design. Hosted: short anti-default excerpt only (don’t stack full text with Taste + Impeccable).
- **One-liner:** Distinctive production frontend direction — type, color, motion, spatial composition — explicitly anti–generic AI UI.
- **Crew fit:** Build pack primary generative taste; complements Impeccable gate.

---

### B. Typography, color, accessibility, interface polish

#### 5. Vercel Labs — web-design-guidelines
- **Location:** https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines · guidelines https://vercel.com/design/guidelines
- **Need:** Full skill for QA/coding review. Hosted: map key checks into publish checklist (or Cursor review step).
- **One-liner:** Audits UI code against Vercel Web Interface Guidelines as terse `file:line` findings (a11y, forms, motion, copy).
- **Crew fit:** Soft publish / Quality gate after Impeccable detect; Build pack pre-merge.

#### 6. jakubkrehel / skills (Interfaces)
- **Location:** https://github.com/jakubkrehel/skills · https://jakub.kr/skills
- **Need:** Selective installs — `better-typography`, `better-colors`, `better-accessibility`, `better-ui`, `better-interface`. Not all 20 in Convex.
- **One-liner:** Focused polish skills for type, color systems, layout, a11y, and ranked interface review.
- **Crew fit:** Build pack + WMVP Design. `better-typography` / `better-colors` deepen Iris token lock; `better-accessibility` reinforces Pro Max priority-1 and Impeccable audit.

#### 7. rampstackco — design-standards *(tokens + AA floor)*
- **Location:** https://github.com/rampstackco/claude-skills/tree/main/skills/design-standards
- **Need:** Skill file / excerpt for token minimums + WCAG AA contrast rules into Brand Book / Iris.
- **One-liner:** Six-standard framework — design tokens, WCAG AA contrast, hierarchy, spacing, breakpoints, quality floor.
- **Crew fit:** Compress into VisualSystem schema validation before LandingSpec; good “token completeness” check.

#### 8. Dammyjay93 — interface-design
- **Location:** https://github.com/Dammyjay93/interface-design
- **Need:** Coding agents for dashboards/SaaS chrome.
- **One-liner:** Craft-focused skill for dashboards, admin panels, SaaS app UI.
- **Crew fit:** Member dashboard / Studio later; skip Phase A marketing LandingSpec.

---

### C. Website animation (“G-Sub” / GSAP) & interaction

#### 9. GSAP Skills (official) — **“G-Sub”**
- **Location:** https://github.com/greensock/gsap-skills
- **Need:** Full install for Build pack / Engineering. Hosted: **short MotionSpec excerpt** only (`design.motion.principles` — transform/opacity, reduced-motion, no layout thrash).
- **One-liner:** Official GreenSock agent skills — core, timelines, ScrollTrigger, plugins, React `useGSAP`, performance.
- **Crew fit:** Kai motion chapter; sparse Leo motion notes on LandingSpec (hero stagger, CTA hover — not awwwards theatres).

#### 10. iart-ai / web-animation-skills
- **Location:** https://github.com/iart-ai/web-animation-skills
- **Need:** Subset: `60fps-animation`, `accessible-animation`, `svg-animation`. Skip glassmorphism/ascii for WMVP default.
- **One-liner:** Broader web motion pack (GSAP, Lottie, micro-interactions, page transitions, a11y motion, SVG).
- **Crew fit:** Build pack depth; accessible-animation rules feed self-check checklist.

#### 11. Emil Kowalski — design-eng + apple-design
- **Location:** https://github.com/emilkowalski/skills
- **Need:** Full install on coding agents; optional 5–10 interaction rules in Leo appendix.
- **One-liner:** Animation and interaction polish (springs, gestures, timing taste).
- **Crew fit:** Build pack micro-interactions; not a Convex job skill.

#### 12. iotron / gsap-cookbook *(optional)*
- **Location:** https://github.com/iotron/gsap-cookbook
- **Need:** Recipes after official gsap-skills; Kai only.
- **One-liner:** Production GSAP recipe pack (scroll, text, SVG, cursor, VFX).
- **Crew fit:** Advanced Engineering motion; skip MVP landings.

#### Defer
- https://github.com/navinramharak-rgb/50k-website-builder  
- https://github.com/kash-123/cinematic-scroll-landing  
Wrong product shape for weekend MVP shell.

#### Index (link-only)
- https://github.com/frankxai/awesome-motion-design-agent-skills — curated GSAP / Motion / Remotion / Lottie / Rive shelf.

---

### D. Icons & vector graphics

#### 13. jezweb — icon-set-generator
- **Location:** https://github.com/jezweb/claude-skills/tree/main/plugins/design-assets/skills/icon-set-generator
- **Need:** **Skill file / pinned SVG template rules** as `design.icons.rules` (or generateSet later).
- **One-liner:** Cohesive project SVG icon sets — shared stroke, grid, padding, `currentColor`.
- **Crew fit:** Brand Book + LandingSpec feature glyphs after VisualSystem lock. Default custom-icon path.

#### 14. kubai087 — kubai-icons
- **Location:** https://github.com/kubai087/kubai-icons · https://www.kubai.design/kubai-icons/
- **Need:** Full skill + engine when product wants distinctive animated icons. Pick **one** of Kubai vs icon-set-generator.
- **One-liner:** Consistent dynamic/static SVG icons with shared engine, hover gestures, headless self-check.
- **Crew fit:** Engineering employee product chrome; heavier than icon-set-generator for simple landings.

#### 15. SoraLabsOSS — animating-icons
- **Location:** https://github.com/SoraLabsOSS/skills (skill: `animating-icons`)
- **Need:** Build pack when icon motion must be measurable.
- **One-liner:** Icon motion craft — gesture families, morph rules, verify harness.
- **Crew fit:** Post-landing product UI polish.

#### 16. ConvenientSolutions — animated-svg-icons
- **Location:** https://github.com/ConvenientSolutions/animated-svg-icons
- **Need:** Skill + examples for Framer Motion / rAF hover icons in React.
- **One-liner:** Two-stage hover SVG icons with guaranteed return-to-rest.
- **Crew fit:** Build pack for Next/React product UI.

#### 17. Zacklinkk — svg-foundry-skill
- **Location:** https://github.com/Zacklinkk/svg-foundry-skill
- **Need:** Full install for logo/illustration/SVG optimize on design agents.
- **One-liner:** Knowledge-driven SVG create / optimize / animate / restyle.
- **Crew fit:** Brand marks, hero SVG, optimize-before-ship. Complements icon-set-generator.

**Also in Pro Max (no separate install):** `data/icons.csv` (Phosphor + a11y), `data/motion.csv` (GSAP-oriented presets).

**Icon default:** Phosphor via Pro Max for chrome + icon-set-generator rules for custom brand/feature glyphs.

---

### E. Screenshot / image / Figma → UI & persistent design systems

#### 18. Google Labs — DESIGN.md (+ design-md skill)
- **Location:** Spec https://github.com/google-labs-code/design.md · skill https://github.com/google-labs-code/stitch-skills/tree/main/plugins/stitch-utilities/skills/design-md · lint `npx @google/design.md lint`
- **Need:** **Format + lint** in repo / Brand Book — Iris should emit DESIGN.md-shaped VisualSystem. Skill install optional (Stitch MCP path).
- **One-liner:** Persistent plain-text design system (YAML tokens + rationale) agents read across sessions; CLI lint includes contrast.
- **Crew fit:** **Canonical export of VisualSystem lock** stored per business. Aligns anti-slop B with something Kai/Cursor can reopen. Brand Book = DESIGN.md.

#### 19. VoltAgent — awesome-design-md *(reference library)*
- **Location:** https://github.com/VoltAgent/awesome-design-md
- **Need:** **Link / curated drop-ins** as inspiration for Iris — never ship a competitor’s DESIGN.md as the user’s brand. Use as teaching examples for token section shape.
- **One-liner:** Ready DESIGN.md files analyzed from popular brand sites for agent-consistent UI.
- **Crew fit:** Research shelf for Iris prompts; not auto-applied to customer businesses.

#### 20. Screenshot / image → code skills
- **onewave-ai screenshot-to-code:** https://github.com/onewave-ai/claude-skills/blob/HEAD/screenshot-to-code/SKILL.md — recreate UI from screenshot/mockup with render-and-compare.
- **Leonxlnx image-to-code** (moved): https://github.com/Leonxlnx/imagegen-skills — image → design-system-aware rebuild.
- **abi/screenshot-to-code** *(app, not Agent Skill):* https://github.com/abi/screenshot-to-code — separate OSS app.
- **Need:** Full skill on Build pack when cloning a **approved** design ref. Hosted anti-slop A already uses web refs — screenshot-to-code is for Kai implementing a locked visual, not for Convex LandingSpec HTML.
- **One-liner:** Turn screenshot/mockup into code, then visually verify against the source.
- **Crew fit:** Engineering employee / Cursor after VisualSystem lock when implementing real product screens from refs. Respect copyright — remix systems, don’t lift assets.

#### 21. Figma → code / sync *(when Figma is in the loop)*
- **tankpkg figma-to-code:** https://github.com/tankpkg/skills/blob/main/skills/figma-to-code/SKILL.md  
- **ratacat figma-design-sync:** skills.sh `ratacat/claude-skills` / figma-design-sync  
- **Need:** Full skill + Figma MCP when John designs in Figma. Not required for Phase A agent-generated landings.
- **One-liner:** Extract Figma specs/tokens/screenshots and verify implementation parity.
- **Crew fit:** Later WMVP Design ↔ Engineering handoff; skip until Figma is source of truth.

#### 22. Playwright visual loop *(tooling, high leverage)*
- **Location:** Playwright CLI + skills — https://github.com/microsoft/playwright · field practice pairs with Taste Skill inspect + web-design-guidelines
- **Need:** Install on Build pack / Quality agents (`playwright-cli install --skills` where documented). Hosted: optional headless screenshot of rendered LandingSpec for Impeccable detect input.
- **One-liner:** Agent opens real browser, screenshots desktop/mobile, fixes what it sees.
- **Crew fit:** Closes anti-slop D on coding path; feed rendered HTML into `design.impeccable.detect` on hosted path.

---

### F. Indexes (link-only shelves)

| Link | Role |
|---|---|
| https://github.com/frankxai/awesome-motion-design-agent-skills | Motion skill index |
| https://github.com/bergside/awesome-design-md-skills | DESIGN.md / SKILL.md registry |
| https://www.skills.sh/topic/design | skills.sh Design & UI topic |

---

## Integration map → crew pack

```
Anti-slop A  Design refs          web.fetch (+ optional screenshot-to-code on Kai)
Anti-slop B  VisualSystem lock    Pro Max --design-system → filter via Impeccable/Taste bans
                                  → persist as DESIGN.md-shaped Brand Book
             Icons                icon-set-generator rules (custom) / Pro Max Phosphor (chrome)
Anti-slop C  LandingSpec compose  Impeccable craft-floor + sparse MotionSpec (GSAP principles)
Anti-slop D  Self-check           Impeccable detect + Pro Max/Vercel/jakub a11y checks
                                  (+ Playwright render when available)
Publish      Soft QA              web-design-guidelines / better-interface (coding path)

Build pack   frontend-design + Taste Skill + Pro Max + Impeccable + gsap-skills
             + icon-set-generator + Playwright (+ svg-foundry / Emil / image-to-code as needed)
```

### Concrete registry tools

```ts
"design.proMax.search"        // --design-system | --domain
"design.impeccable.detect"    // rendered HTML/CSS
"design.icons.rules"          // pinned icon-set-generator template
"design.motion.principles"    // short GSAP/60fps/reduced-motion excerpt
"design.visualSystem.export"  // DESIGN.md-shaped snapshot per business
```

### Conflicts to pin

1. Pro Max trendy styles vs Impeccable / Taste bans → filter before lock.  
2. Impeccable vs WMVP eyebrows / 01–02–03 → exception or change template.  
3. Taste Skill + frontend-design + Impeccable → coding generative taste vs hosted gate; never three full SKILL dumps in Leo.  
4. awesome-design-md brand files → inspiration only, never customer identity.  
5. Cinematic/$50k scroll skills → defer for weekend shell.

---

## Suggested installs (Build pack / coding agents)

```bash
# Already on box for design agents:
# ~/.claude/skills/ui-ux-pro-max

npx skills add https://github.com/pbakaus/impeccable
npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend
npx skills add https://github.com/anthropics/skills --skill frontend-design
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
npx skills add https://github.com/greensock/gsap-skills
npx skills add https://github.com/jakubkrehel/skills --skill better-typography
npx skills add https://github.com/jakubkrehel/skills --skill better-accessibility
# Icons / SVG (pick path):
# icon-set-generator from jezweb/claude-skills (verify skill path after clone)
npx skills add https://github.com/Zacklinkk/svg-foundry-skill
# Optional:
npx skills add https://github.com/emilkowalski/skills --skill emil-design-eng
npx skills add https://github.com/Leonxlnx/imagegen-skills --skill image-to-code
```

DESIGN.md lint when Brand Book exists:

```bash
npx @google/design.md lint DESIGN.md
```

---

## One-page decision for John

1. **Hosted Phase A:** Pro Max → DESIGN.md-shaped VisualSystem lock → Impeccable craft-floor + detect → icon-set-generator rules → short motion/a11y principles.  
2. **Build pack:** add **Taste Skill** + Anthropic frontend-design + Vercel guidelines + **GSAP** + Playwright visual loop (+ typography/a11y polish skills).  
3. **“G-Sub”** = GSAP → [greensock/gsap-skills](https://github.com/greensock/gsap-skills).  
4. Screenshot/Figma-to-code = Kai path after lock, not Convex LandingSpec.  
5. Skip cinematic scroll builders; don’t dual-stack Kubai + icon-set-generator + Sora at once.

Supersedes `impeccable-integration-note.md` as the full catalogue (that note remains valid for Pro Max ↔ Impeccable sequencing detail).
