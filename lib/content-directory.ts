/** Only published content roots may be read by the shared filesystem loaders. */
export function contentDirectory(dir: string): string {
  switch (dir) {
    case "content/ideas": return "ideas";
    case "content/articles": return "articles";
    case "content/newsletter-pages": return "newsletter-pages";
    default: throw new Error("Unsupported content directory");
  }
}
