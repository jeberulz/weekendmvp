import "server-only";

import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { readMdxFile, type MdxFile } from "@/lib/mdx";

type StoredBody = { bodyMode?: string; body?: string };

/** Public pages and member exports share this exact source precedence. */
export function chooseIdeaBody(file: MdxFile | null, idea: StoredBody | null) {
  if (file) return { source: "mdx" as const, content: file.content };
  if (idea?.bodyMode === "convex" && idea.body) {
    return { source: "convex" as const, content: idea.body };
  }
  return null;
}

/** Backend failures propagate; an unavailable body is not an empty export. */
export async function readCanonicalIdeaBody(slug: string, token: string | null) {
  if (!token) return null;
  // The member query verifies the current session before even a checked-in
  // MDX file can be read for a prompt/export caller.
  const idea = await fetchQuery(api.ideas.bySlugForMember, { slug }, { token });
  const publication = await fetchQuery(api.editorial.public.bySlug, { slug });
  if (publication.state === "removed") return null;
  if (publication.state === "released") {
    const full = await fetchQuery(api.editorial.public.bySlugForMember, { slug }, { token });
    return full.state === "released" ? { source: "editorial" as const, content: full.markdown } : null;
  }
  const file = await readMdxFile("content/ideas", slug);
  if (file) return chooseIdeaBody(file, null);
  return chooseIdeaBody(null, idea);
}
