import type { SiteInputPayload } from "@/convex/platform/engine/contracts";
import type {
  PreviewTemplate,
  SiteRenderSpec,
} from "@/convex/platform/preview/renderSpec";
import { PreviewNotice, PreviewWatermark } from "./PreviewWatermark";

/**
 * WP27-S3. The structured renderer.
 *
 * Three rules hold across every template here, and the tests in
 * `tests/security/wp27-templates.test.tsx` assert each one per template
 * rather than once for the set:
 *
 * 1. **Named fields only.** A template destructures the exact fields it
 *    renders. None of them iterates the spec's keys or spreads it onto an
 *    element. WP26-S1's parser validates the named contract but returns the
 *    parsed object as-is, so unknown keys survive validation — harmless to a
 *    reader of named fields, and the injection vector if anything ever
 *    spread it.
 * 2. **No raw markup.** No `dangerouslySetInnerHTML`, no `<script>`, no
 *    caller-supplied CSS or class strings. Every value lands as React text,
 *    which escapes it.
 * 3. **No caller-derived URLs.** `SiteInputPayload` v1 carries no URL field
 *    (all values are text, and citations are numeric positions), so no
 *    template constructs an `href` or `src` from spec content at all. That
 *    is a stronger property than allowlisting protocols, and the tests
 *    assert it structurally so a future field cannot quietly introduce one.
 */

/**
 * `showPreviewChrome` is required, never defaulted. WP28-S3 reuses these
 * templates to render *published customer sites*, where the preview notice and
 * watermark must not appear. A default would decide that silently at every
 * future call site; the two directions fail differently but both fail badly —
 * a customer's live page stamped "PREVIEW", or a preview that no longer says
 * it is one.
 */
type TemplateProps = {
  siteInput: SiteInputPayload;
  showPreviewChrome: boolean;
};

const PAPER = "compiled-landing bg-[#fcfaf7] text-[#1c1917]";
const MUTED = "text-[#44403c]";
const LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-[#57534e]";

function LandingFrame({
  showPreviewChrome,
  children,
}: {
  showPreviewChrome: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {showPreviewChrome && <PreviewNotice />}
      <div className={PAPER}>{children}</div>
      {showPreviewChrome && <PreviewWatermark />}
    </>
  );
}

function Benefits({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-4">
      {items.map((benefit, index) => (
        // Index keys are safe here: the list is fixed for the lifetime of a
        // rendered preview and is never reordered or filtered.
        <li
          key={`benefit-${index}`}
          className={`flex gap-3 text-base leading-relaxed ${MUTED}`}
        >
          <span
            aria-hidden="true"
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#cc5500]"
          />
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  );
}

function SocialProof({ items }: { items: SiteInputPayload["socialProof"] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-3">
      {items.map((entry, index) => (
        <li
          key={`proof-${index}`}
          className="rounded-2xl border border-stone-900/10 bg-white px-4 py-2.5 text-sm leading-snug text-[#1c1917]"
        >
          {entry.stat}
        </li>
      ))}
    </ul>
  );
}

/**
 * The call to action is deliberately an inert `<button type="button">`, not
 * a link: a preview must not be able to send a visitor anywhere, and there
 * is no destination in the contract to send them to. `S4` additionally
 * guarantees no lead-capture endpoint is reachable from this route.
 */
function CallToAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="min-h-12 rounded-2xl bg-[#cc5500] px-6 font-medium text-[#fcfaf7] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:bg-[#b34b00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc5500] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fcfaf7] active:scale-[0.98]"
    >
      {label}
    </button>
  );
}

function EditorialTemplate({ siteInput, showPreviewChrome }: TemplateProps) {
  const {
    headline,
    subheadline,
    problemStatement,
    keyBenefits,
    socialProof,
    callToAction,
  } = siteInput;
  return (
    <LandingFrame showPreviewChrome={showPreviewChrome}>
      <main className="mx-auto grid min-h-[100dvh] w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20 lg:py-24">
        <div className="compiled-rise">
          <h1 className="max-w-[16ch] text-4xl font-semibold tracking-tight text-[#1c1917] sm:text-5xl sm:leading-[1.08]">
            {headline}
          </h1>
          <p
            className={`mt-5 max-w-[36em] text-lg leading-relaxed ${MUTED}`}
          >
            {subheadline}
          </p>
          <div className="mt-10">
            <CallToAction label={callToAction.label} />
          </div>
        </div>
        <aside className="compiled-rise delay-200 rounded-3xl border border-stone-900/10 bg-white p-6 shadow-[0_20px_40px_-24px_rgba(28,25,23,0.18)] sm:p-8">
          <h2 className={LABEL}>The problem</h2>
          <p className={`mt-3 leading-relaxed ${MUTED}`}>{problemStatement}</p>
          <h2 className={`${LABEL} mt-8`}>What it does</h2>
          <div className="mt-4">
            <Benefits items={keyBenefits} />
          </div>
          <div className="mt-8">
            <SocialProof items={socialProof} />
          </div>
        </aside>
      </main>
    </LandingFrame>
  );
}

function ProductTemplate({ siteInput, showPreviewChrome }: TemplateProps) {
  const {
    headline,
    subheadline,
    problemStatement,
    keyBenefits,
    socialProof,
    callToAction,
  } = siteInput;
  return (
    <LandingFrame showPreviewChrome={showPreviewChrome}>
      <main className="mx-auto min-h-[100dvh] w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="compiled-rise grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(14rem,0.75fr)] lg:items-end">
          <div>
            <h1 className="max-w-[18ch] text-4xl font-semibold tracking-tight text-[#1c1917] sm:text-5xl sm:leading-[1.08]">
              {headline}
            </h1>
            <p
              className={`mt-5 max-w-[36em] text-lg leading-relaxed ${MUTED}`}
            >
              {subheadline}
            </p>
          </div>
          <div className="lg:justify-self-end">
            <CallToAction label={callToAction.label} />
          </div>
        </div>
        <div className="compiled-rise delay-200 mt-16 grid gap-10 border-t border-stone-900/10 pt-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-[#1c1917]">
              Why it matters
            </h2>
            <p className={`mt-3 leading-relaxed ${MUTED}`}>
              {problemStatement}
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-[#1c1917]">
              What you get
            </h2>
            <div className="mt-4">
              <Benefits items={keyBenefits} />
            </div>
          </section>
        </div>
        <div className="compiled-rise delay-300 mt-12">
          <SocialProof items={socialProof} />
        </div>
      </main>
    </LandingFrame>
  );
}

function MinimalTemplate({ siteInput, showPreviewChrome }: TemplateProps) {
  const { headline, subheadline, keyBenefits, callToAction } = siteInput;
  return (
    <LandingFrame showPreviewChrome={showPreviewChrome}>
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col justify-center px-5 py-20 sm:px-8">
        <div className="compiled-rise">
          <span
            aria-hidden="true"
            className="mb-8 block h-px w-12 bg-[#cc5500]"
          />
          <h1 className="text-4xl font-semibold tracking-tight text-[#1c1917] sm:leading-[1.1]">
            {headline}
          </h1>
          <p className={`mt-4 text-lg leading-relaxed ${MUTED}`}>
            {subheadline}
          </p>
          {/* Minimal shows the first benefit only. It reads a named index of a
            validated array rather than slicing on caller-supplied bounds. */}
          {keyBenefits.length > 0 && (
            <p className={`mt-8 border-l-2 border-[#cc5500] pl-4 ${MUTED}`}>
              {keyBenefits[0]}
            </p>
          )}
          <div className="mt-10">
            <CallToAction label={callToAction.label} />
          </div>
        </div>
      </main>
    </LandingFrame>
  );
}

/**
 * Closed dispatch table. A `templateId` is only ever used as a key into this
 * frozen record, never as a path segment, import specifier, or component
 * name — so even if validation upstream were bypassed, an unknown id selects
 * nothing rather than resolving somewhere arbitrary.
 */
const TEMPLATES: Record<
  PreviewTemplate,
  (props: TemplateProps) => React.ReactElement
> = {
  editorial: EditorialTemplate,
  product: ProductTemplate,
  minimal: MinimalTemplate,
};

export function PreviewTemplateRenderer({
  spec,
  showPreviewChrome,
}: {
  spec: SiteRenderSpec;
  showPreviewChrome: boolean;
}) {
  // `Object.hasOwn`, not a bare index read: `TEMPLATES["constructor"]` and
  // `TEMPLATES["toString"]` resolve to inherited functions that are truthy,
  // so the `!Template` guard below would wave them through. Unreachable via
  // the parser today; this makes the dispatch safe on its own terms.
  const Template = Object.hasOwn(TEMPLATES, spec.templateId)
    ? TEMPLATES[spec.templateId]
    : undefined;
  // Defensive: `parseSiteRenderSpec` already rejects an unknown id, so this
  // is unreachable through the normal path. Rendering nothing is still the
  // right failure — never a partial or unvalidated page.
  if (!Template) return null;
  return (
    <Template
      siteInput={spec.siteInput}
      showPreviewChrome={showPreviewChrome}
    />
  );
}

export { EditorialTemplate, MinimalTemplate, ProductTemplate, TEMPLATES };
