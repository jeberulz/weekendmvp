# From audience evidence to Leo’s private preview

Use this brief when a founder asks for a landing page with its own visual identity. The three repository skills support build agents and design reviewers. Their Markdown files are available by path. Hosted Iris and Leo draw on approved business data, bounded structured calls and deterministic checks under D23. [Landing design decisions](../07-landing-design.md) · [Original design skills brief](design-skills-crew-brief.md) · [Crew rulings](../../../wp/RULINGS.md)

| Stage | Question | Handoff |
|---|---|---|
| [Research](../../../../skills/landing-research/SKILL.md) | Who is visiting, what do they need to decide, and what can this business substantiate? | Source notes with document versions or links, the visitor’s hesitation, a product example and a labelled hypothesis for any missing evidence |
| [Iris](../../../../skills/landing-art-direction/SKILL.md) | Which approved visual choices will help the visitor make that decision? | An attributed recommendation tied to the kit version, with the two typefaces, hero and signup treatments, asset brief and fallback |
| [Leo](../../../../skills/landing-compose-review/SKILL.md) | What will the visitor see and what can the founder test? | Validated LandingSpec, saved private version, rendered review and a synthetic signup receipt |

## Two worked decisions

These illustrative briefs assume the named brand direction and goal have already been approved. The founder’s actual inputs take precedence.

| Design decision | A founder evaluating a site-design blueprint | A shift lead evaluating a handover app |
|---|---|---|
| Visitor’s question | “What would I receive?” An excerpt of the blueprint answers this better than a generic image of a laptop. | “Can I find the outstanding job at shift change?” A recognisable entry with an owner and next action makes the workflow inspectable. |
| Type and opening | An editorial `type_led` hero. Instrument Serif makes the sample read like a designed document. Instrument Sans keeps its annotations and the signup label legible. | A `quiet_technical` `product_frame` hero. IBM Plex Sans handles instructions, with the registered Plex Mono face available for short identifiers. |
| What earns the click | A quiet secondary “See a sample” anchor leads to an included `#app` section with a genuine sample title and caption. The primary “Join the waitlist” leads to a compact `inline_band`. | A concrete handover example leads into an annotated product section. The primary “Join the pilot waitlist” leads to a `panel` with the field and a sentence about the pilot. Use the pilot label only if that offer exists. |
| Asset or fallback | For an original illustration, frame the designer’s annotated page from above, keep the type sample central at phone width, and put meaningful sample text in HTML. Today the private design can communicate through the saved text and a branded plate. | Show a composed sample handover record with fictional names, one unresolved job and its next owner. A product-moment title and caption can carry this example even before a screenshot exists. |
| Review question | Can the reader identify one thing the blueprint contains before signing up? | Can the reader identify the next action in the example at phone width? |

The renderer has six directions, a curated font-pair registry, per-direction section variants and a closed icon list. It fixes section order and maps a spec to React. Its art plate currently draws colour and optional product text. An image brief alone cannot put a generated photo on the page. A direction that calls for a photo should specify the fallback and record whether the delivered preview uses it. [Contract](../../../../lib/workspace/contracts/artifacts.ts) · [Renderer](../../../../components/tenant-site/TenantSite.tsx) · [Art plate](../../../../components/tenant-site/sections.tsx)

## Sources and tools

- **Audience and composition.** Start with the approved blueprint, founder statements and any sourced research for this business. Use a reference for a single decision, cite it and describe the principle in your own words. For example, the GOV.UK button guidance connects labels to the action. For this preview that means distinguishing “See a sample” from “Join the waitlist” and checking each destination. [GOV.UK button guidance](https://design-system.service.gov.uk/components/button/)
- **Free Google Fonts.** Choose the permitted pair from the approved kit. The tenant renderer uses static `next/font/google` loaders and serves the selected faces with the app. Check the family’s actual licence and preserve it when packaging fonts. Two examples from the compositions above are Instrument Serif and IBM Plex Sans. [Font loaders](../../../../components/tenant-site/fonts.ts) · [Instrument Serif OFL](https://github.com/google/fonts/blob/main/ofl/instrumentserif/OFL.txt) · [IBM Plex Sans OFL](https://github.com/google/fonts/blob/main/ofl/ibmplexsans/OFL.txt)
- **Icon and image direction.** Select a registered Phosphor name and let the direction set the visual weight. Describe essential visual information in the surrounding text or alternative. Keep decorative imagery quiet in the accessibility tree. The source library and the renderer’s checked icon subset serve different purposes. [Renderer icon map](../../../../components/tenant-site/icons.tsx) · [Phosphor source](https://github.com/phosphor-icons/core) · [W3C image decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/)
- **Rendered checks.** Use Playwright screenshots in a repeatable browser environment and inspect visible content alongside keyboard behavior and the private form receipt. At 320 CSS pixels the page should preserve its content and controls without requiring horizontal scrolling. [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) · [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

## Future API decision

The repo already has vendored design candidates and a metered Recraft provider adapter. Neither gives Leo a web browser, an MCP connection or an image URL in his landing contract. The current private draft needs approved inputs, Iris’s answer and an honest fallback. [Candidate selection](../../../../lib/workspace/crew/design/proMax.ts) · [Recraft adapter](../../../../convex/ai/providers/recraft.ts)

If founder testing shows missing market context, evaluate a separate reference-collection job. Give it a scoped design question, approved public sources, a page/time budget and a source-note output. Pass attributable observations to Iris as quoted data. If missing artwork weakens the page, evaluate a separate image job first. Give it a single approved brief, fixed output count and size, reserved spend, and a project-owned storage destination. Carry the brief version, provider, provenance and inspected result into the asset receipt. Verify cancellation, duplicate requests, safe file delivery and the mobile crop before proposing a renderer field for approved assets. Either job can fail independently while the owner retains the saved preview. [Recraft API overview](https://www.recraft.ai/docs)
