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

function Benefits({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((benefit, index) => (
        // Index keys are safe here: the list is fixed for the lifetime of a
        // rendered preview and is never reordered or filtered.
        <li key={`benefit-${index}`} className="flex gap-3 text-zinc-300">
          <span aria-hidden="true" className="text-orange-400">
            &#8212;
          </span>
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  );
}

function SocialProof({ items }: { items: SiteInputPayload["socialProof"] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-4">
      {items.map((entry, index) => (
        <li
          key={`proof-${index}`}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300"
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
      className="min-h-12 rounded-lg bg-orange-700 px-6 font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {label}
    </button>
  );
}

function EditorialTemplate({ siteInput, showPreviewChrome }: TemplateProps) {
  const { headline, subheadline, problemStatement, keyBenefits, socialProof, callToAction } =
    siteInput;
  return (
    <>
      {showPreviewChrome && <PreviewNotice />}
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-100">
          {headline}
        </h1>
        <p className="mt-4 text-xl text-zinc-300">{subheadline}</p>
        <hr className="my-10 border-white/10" />
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
          The problem
        </h2>
        <p className="mt-3 leading-relaxed text-zinc-300">{problemStatement}</p>
        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-zinc-400">
          What it does
        </h2>
        <div className="mt-3">
          <Benefits items={keyBenefits} />
        </div>
        <div className="mt-10">
          <SocialProof items={socialProof} />
        </div>
        <div className="mt-10">
          <CallToAction label={callToAction.label} />
        </div>
      </main>
      {showPreviewChrome && <PreviewWatermark />}
    </>
  );
}

function ProductTemplate({ siteInput, showPreviewChrome }: TemplateProps) {
  const { headline, subheadline, problemStatement, keyBenefits, socialProof, callToAction } =
    siteInput;
  return (
    <>
      {showPreviewChrome && <PreviewNotice />}
      <main className="mx-auto w-full max-w-4xl px-5 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-semibold leading-tight tracking-tight text-zinc-100">
            {headline}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-xl text-zinc-300">
            {subheadline}
          </p>
          <div className="mt-8 flex justify-center">
            <CallToAction label={callToAction.label} />
          </div>
        </div>
        <div className="mt-16 grid gap-10 sm:grid-cols-2">
          <section>
            <h2 className="text-lg font-medium text-zinc-100">
              Why it matters
            </h2>
            <p className="mt-3 leading-relaxed text-zinc-300">
              {problemStatement}
            </p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-zinc-100">What you get</h2>
            <div className="mt-3">
              <Benefits items={keyBenefits} />
            </div>
          </section>
        </div>
        <div className="mt-14 flex justify-center">
          <SocialProof items={socialProof} />
        </div>
      </main>
      {showPreviewChrome && <PreviewWatermark />}
    </>
  );
}

function MinimalTemplate({ siteInput, showPreviewChrome }: TemplateProps) {
  const { headline, subheadline, keyBenefits, callToAction } = siteInput;
  return (
    <>
      {showPreviewChrome && <PreviewNotice />}
      <main className="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col justify-center px-5 py-16">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-100">
          {headline}
        </h1>
        <p className="mt-4 text-lg text-zinc-300">{subheadline}</p>
        {/* Minimal shows the first benefit only. It reads a named index of a
            validated array rather than slicing on caller-supplied bounds. */}
        {keyBenefits.length > 0 && (
          <p className="mt-8 text-zinc-400">{keyBenefits[0]}</p>
        )}
        <div className="mt-10">
          <CallToAction label={callToAction.label} />
        </div>
      </main>
      {showPreviewChrome && <PreviewWatermark />}
    </>
  );
}

/**
 * Closed dispatch table. A `templateId` is only ever used as a key into this
 * frozen record, never as a path segment, import specifier, or component
 * name — so even if validation upstream were bypassed, an unknown id selects
 * nothing rather than resolving somewhere arbitrary.
 */
const TEMPLATES: Record<PreviewTemplate, (props: TemplateProps) => React.ReactElement> = {
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
