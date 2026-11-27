import type { HomeCopy } from "@/lib/landing/read-home";
import { Container } from "../ui";

export function AdditionalHomeSections({ sections }: { sections: HomeCopy["additionalSections"] }) {
  return sections.map((section, index) => (
    <section key={index} className="border-t border-home-rule bg-home-paper py-12 lg:py-16">
      <Container className="flex flex-col gap-5">
        <h2 className="max-w-3xl font-editorial text-4xl leading-tight text-home-ink lg:text-5xl">
          {section.value.title}
        </h2>
        {section.discriminant === "editorialNote" ? (
          <p className="max-w-[680px] whitespace-pre-line leading-relaxed text-home-ink-2">{section.value.body}</p>
        ) : (
          <ul className="max-w-[680px] list-disc space-y-2 pl-5 leading-relaxed text-home-ink-2">
            {section.value.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
          </ul>
        )}
      </Container>
    </section>
  ));
}
