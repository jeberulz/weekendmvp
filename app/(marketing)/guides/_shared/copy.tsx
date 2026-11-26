import Link from "next/link";

import type { GuideDeck } from "./types";

// The deck uses only links, emphasis, lists and block quotes in its prose slots.
function renderInlineCopy(text: string) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/);
  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((\/[^)]+)\)$/);
    if (link) return <Link key={index} href={link[2]}>{link[1]}</Link>;
    if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

/** Look a slot up in the deck. A missing slot throws, so a bad guide fails the build. */
export function slotText(deck: GuideDeck, slot: string): string {
  const text = deck[slot];
  if (text === undefined) throw new Error(`Guide copy slot is missing from the deck: "${slot}"`);
  return text;
}

export function GuideCopy({ deck, slot, ideaCount }: { deck: GuideDeck; slot: string; ideaCount?: number }) {
  const raw = slotText(deck, slot);
  const text = ideaCount === undefined ? raw : raw.replaceAll("{ideaCount}", String(ideaCount));

  return (
    <div className="guide-copy" data-copy-slot={slot}>
      {text.split("\n\n").map((block) => {
        if (/^(?:- |\d+\. )/.test(block)) {
          const List = block.startsWith("- ") ? "ul" : "ol";
          return (
            <List key={block}>
              {block.split("\n").map((line) => <li key={line}>{renderInlineCopy(line.replace(/^(?:- |\d+\. )/, ""))}</li>)}
            </List>
          );
        }
        if (block.startsWith("> ")) return <blockquote key={block}>{renderInlineCopy(block.slice(2))}</blockquote>;
        return <p key={block} className={slot.endsWith(" · Lede") ? "guide-lede" : undefined}>{renderInlineCopy(block)}</p>;
      })}
    </div>
  );
}
