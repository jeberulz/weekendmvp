// Vercel Edge Function for redirecting to the most recent idea
// Used in welcome emails to always show fresh content

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    // Fetch the manifest to get the ideas list
    // In edge functions, we need to fetch from the deployed URL or use a relative path
    const url = new URL(req.url);
    const manifestUrl = `${url.protocol}//${url.host}/ideas/manifest.json`;

    const manifestResponse = await fetch(manifestUrl);

    if (!manifestResponse.ok) {
      // Fallback to startup-ideas page if manifest is missing
      return Response.redirect(`${url.protocol}//${url.host}/startup-ideas.html`, 302);
    }

    const manifest = await manifestResponse.json();

    // Check if manifest has ideas
    if (!manifest.ideas || manifest.ideas.length === 0) {
      // Fallback to startup-ideas page if no ideas
      return Response.redirect(`${url.protocol}//${url.host}/startup-ideas.html`, 302);
    }

    // Sort ideas by publishedAt descending (newest first) and get the most recent
    const sortedIdeas = manifest.ideas.sort((a, b) =>
      new Date(b.publishedAt) - new Date(a.publishedAt)
    );
    const mostRecentIdea = sortedIdeas[0];

    // Redirect to the idea page
    return Response.redirect(`${url.protocol}//${url.host}/ideas/${mostRecentIdea.slug}.html`, 302);

  } catch (error) {
    console.error('Error in ideas-today redirect:', error);

    // Fallback to startup-ideas page on any error
    const url = new URL(req.url);
    return Response.redirect(`${url.protocol}//${url.host}/startup-ideas.html`, 302);
  }
}
