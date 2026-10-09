import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/home/ui";
import { PageHeader } from "@/components/public/PageHeader";
import type { Block, LegalDoc, LegalSection, Pending } from "@/lib/legal/content";
import { MEMBERSHIP_LEGAL_APPROVED } from "@/lib/legal/status";
import { newsreaderEditorial } from "@/lib/fonts";
import { cn } from "@/lib/utils";

/**
 * WP64-S9. Renders a legal document from `lib/legal/content.ts` in the
 * privacy policy's layout. While the text is a draft, it shows a draft
 * banner, each section's review notes and every `{{O2: …}}` gap.
 */

const LINK =
  "text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-home-orange-ink motion-reduce:transition-none";

const OG_IMAGE = "/image/og-image.png";

export function legalMetadata(doc: LegalDoc): Metadata {
  const title = `${doc.title} | Weekend MVP`;
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: doc.path },
    // Drafts never reach an index, even if a production build shows them.
    ...(MEMBERSHIP_LEGAL_APPROVED ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      type: "website",
      url: doc.path,
      title,
      description: doc.description,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Weekend MVP — ship your product in 48 hours", type: "image/png" }],
    },
    twitter: { card: "summary_large_image", title, description: doc.description, images: [OG_IMAGE] },
  };
}

/** `{{O2: what}}` becomes a highlighted gap. The text around it is plain. */
export function LegalText({ text }: { text: string }) {
  // Two capture groups: [text, code, what, text, code, what, …, text].
  const parts = text.split(/\{\{(O\d): ([^}]+)\}\}/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 3 === 0) return part;
        if (i % 3 === 2) return null;
        return (
          <mark key={i} className="rounded-sm bg-home-note px-1 text-home-ink">
            To be confirmed ({part}): {parts[i + 1]}
          </mark>
        );
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === "list") {
    return (
      <ul className="list-disc space-y-2 pl-5 marker:text-home-ink-3">
        {block.items.map((item) => (
          <li key={item}>
            <LegalText text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p>
      <LegalText text={block.text} />
      {block.link ? (
        <>
          {" "}
          <Link href={block.link.href} className={LINK}>
            {block.link.label}
          </Link>
          .
        </>
      ) : null}
    </p>
  );
}

const REVIEWER: Record<Pending["by"], string> = {
  O1: "Open decision O1",
  O2: "Open decision O2",
  O3: "Open decision O3",
  O4: "Open decision O4",
  O8: "Open decision O8",
  O9: "Open decision O9",
  lawyer: "For the lawyer",
  owner: "For the owner",
};

function ReviewNotes({ pending }: { pending: readonly Pending[] }) {
  return (
    <div className="rounded-md border border-home-rule bg-home-ochre px-4 py-3 text-sm leading-[1.55] text-home-ochre-ink">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em]">Review notes</p>
      <ul className="mt-2 space-y-1.5">
        {pending.map((item) => (
          <li key={`${item.by}-${item.note}`}>
            <span className="font-medium">{REVIEWER[item.by]}:</span> {item.note}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LegalSectionRow({ section }: { section: LegalSection }) {
  const pending = MEMBERSHIP_LEGAL_APPROVED ? [] : (section.pending ?? []);
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-heading`}
      className="grid scroll-mt-28 grid-cols-1 gap-4 border-t border-home-rule py-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12"
    >
      <h2
        id={`${section.id}-heading`}
        className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-3 md:text-xs"
      >
        {section.heading}
      </h2>
      <div className="flex max-w-[680px] flex-col gap-4 text-base leading-[1.65] text-home-ink-2">
        {section.blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
        {pending.length > 0 ? <ReviewNotes pending={pending} /> : null}
      </div>
    </section>
  );
}

export function DraftBanner() {
  if (MEMBERSHIP_LEGAL_APPROVED) return null;
  return (
    <div className="rounded-md border border-home-rule bg-home-note px-4 py-4 text-sm leading-[1.6] text-home-ink md:px-5">
      <p className="font-medium">Draft for review. Not in force.</p>
      <p className="mt-1">
        The owner and a lawyer or accountant of the owner&apos;s choosing still need to review this text. The live site
        hides it until then. Highlighted text is a fact still to be supplied, and review notes name the open decision
        behind a section. This is not legal advice.
      </p>
    </div>
  );
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div
      className={cn(
        newsreaderEditorial.variable,
        "theme-desk relative min-h-screen overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40",
      )}
    >
      <main id="main">
        <PageHeader
          title={doc.title}
          description={doc.intro}
          meta={[MEMBERSHIP_LEGAL_APPROVED ? "Last updated: October 2026" : "Draft: October 2026"]}
          size="md"
          className="pb-10 lg:pb-12"
        />

        <Container className="pb-20 lg:pb-28">
          <DraftBanner />
          <nav aria-label="On this page" className="py-8">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-3 md:text-xs">
              On this page
            </p>
            <ol className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className={LINK}>
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {doc.sections.map((section) => (
            <LegalSectionRow key={section.id} section={section} />
          ))}
        </Container>
      </main>
    </div>
  );
}
