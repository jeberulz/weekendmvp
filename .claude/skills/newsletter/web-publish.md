# Newsletter Web Publish

Step 5b of the `/newsletter today` flow: generate the public web page for each slot, then refresh the feed.

Each send produces one static HTML file at `newsletter/YYYY-MM-DD-{am,pm}.html` and the `scripts/update-newsletter-archive.js` regenerates the card grid + JSON-LD ItemList on `newsletter.html`.

---

## Page template

The skill writes the file below, substituting the placeholders `{{ ... }}`. The template mirrors the shape of `articles/*.html` — same nav, same fonts, same footer — so newsletter detail pages feel native, not bolted-on.

```html
<!DOCTYPE html>
<html lang="en" class="antialiased dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}} | Weekend MVP Newsletter</title>
    <meta name="description" content="{{description}}">
    <meta name="author" content="John Iseghohi">

    <meta property="og:type" content="article">
    <meta property="og:url" content="https://weekendmvp.app/newsletter/{{slug}}.html">
    <meta property="og:title" content="{{title}}">
    <meta property="og:description" content="{{description}}">
    <meta property="og:image" content="https://weekendmvp.app/image/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://weekendmvp.app/newsletter/{{slug}}.html">
    <meta property="twitter:title" content="{{title}}">
    <meta property="twitter:description" content="{{description}}">
    <meta property="twitter:image" content="https://weekendmvp.app/image/og-image.png">

    <link rel="canonical" href="https://weekendmvp.app/newsletter/{{slug}}.html">

    <link rel="icon" type="image/png" href="../image/favicon.png">
    <link rel="apple-touch-icon" href="../image/webclip.png">

    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
    <link rel="stylesheet" href="../styles.css">

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "{{title}}",
      "description": "{{description}}",
      "author": {
        "@type": "Person",
        "name": "John Iseghohi",
        "url": "https://cal.com/switchtoux"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Weekend MVP",
        "url": "https://weekendmvp.app"
      },
      "datePublished": "{{date}}",
      "dateModified": "{{date}}",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "https://weekendmvp.app/newsletter/{{slug}}.html"
      },
      "image": "https://weekendmvp.app/image/og-image.png"
    }
    </script>
</head>
<body class="relative min-h-screen overflow-x-hidden selection:bg-white/20 selection:text-white bg-[#050505]">

    <div class="fixed inset-0 pointer-events-none z-0 grid-lines"></div>

    <!-- Navigation (minimal, matches articles/*.html pattern) -->
    <div class="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 animate-enter">
        <nav class="flex items-center justify-between w-full max-w-4xl h-14 pl-6 pr-2 bg-neutral-950/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
            <a href="../index.html" class="flex items-center gap-2">
                <div class="logo h-4 w-32 md:h-5 md:w-40 text-white" role="img" aria-label="Weekend MVP"></div>
            </a>
            <div class="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
                <a href="../startup-ideas.html" class="hover:text-white transition-colors">Ideas</a>
                <a href="../articles.html" class="hover:text-white transition-colors">Articles</a>
                <a href="../newsletter.html" class="text-white" aria-current="page">Newsletter</a>
                <a href="../starter-kit.html" class="hover:text-white transition-colors">Starter Kit</a>
            </div>
            <a href="../starter-kit.html" class="group relative inline-flex overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-black transition-transform active:scale-95">
                <span class="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,rgba(255,255,255,0.5)_50%,transparent_100%)]"></span>
                <span class="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-neutral-950/80 px-5 py-2 text-xs font-semibold text-white backdrop-blur-3xl transition-all group-hover:bg-neutral-900/80">Get the Kit</span>
            </a>
        </nav>
    </div>

    <article data-nl-slot="{{slot}}" class="relative z-10 pt-32 pb-24">
        <div class="max-w-2xl mx-auto px-6">

            <nav class="mb-8 text-xs text-neutral-500" aria-label="Breadcrumb">
                <a href="../index.html" class="hover:text-white transition-colors">Home</a>
                <span class="mx-2">/</span>
                <a href="../newsletter.html" class="hover:text-white transition-colors">Newsletter</a>
                <span class="mx-2">/</span>
                <span class="text-neutral-400">{{dateLabel}} — {{slotShort}}</span>
            </nav>

            <header class="mb-16">
                <div class="flex items-center gap-3 mb-6">
                    <span class="px-2 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{{slotLabel}}</span>
                    <span class="text-neutral-600 text-xs">•</span>
                    <time class="text-neutral-600 text-xs" datetime="{{date}}">{{dateLabel}}</time>
                </div>
                <h1 class="text-4xl md:text-5xl font-medium text-white tracking-tight leading-[1.1] mb-6">{{title}}</h1>
                <p class="text-xl text-neutral-400 font-light leading-relaxed">{{subtitle}}</p>
            </header>

            <div class="prose-nl text-neutral-300 leading-relaxed space-y-6">
                {{bodyHtml}}
            </div>

            <!-- Mid CTA: owned site link -->
            <div class="my-16 p-8 bg-white/[0.02] border border-white/10 rounded-2xl text-center">
                <p class="text-neutral-400 text-sm mb-4">Want more ideas like this?</p>
                <a href="../startup-ideas.html" class="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all">
                    <span>Browse 45+ startup ideas</span>
                    <iconify-icon icon="lucide:arrow-right" width="16" aria-hidden="true"></iconify-icon>
                </a>
            </div>

            <!-- Inline subscribe form -->
            <section class="mt-16 p-8 bg-white/[0.02] border border-white/10 rounded-2xl">
                <h2 class="text-xl md:text-2xl font-medium text-white tracking-tight mb-2">Get the next one in your inbox</h2>
                <p class="text-sm text-neutral-400 mb-6">Free. 2 emails a day. Unsubscribe anytime.</p>
                <form data-newsletter-subscribe
                      data-utm-campaign="newsletter-web-{{slot}}"
                      class="flex flex-col sm:flex-row gap-2"
                      novalidate>
                    <label for="nl-{{slug}}-email" class="sr-only">Email address</label>
                    <input
                        type="email"
                        id="nl-{{slug}}-email"
                        name="email"
                        required
                        placeholder="you@example.com"
                        aria-label="Email address"
                        class="flex-1 bg-white/[0.03] border border-white/10 rounded-full px-5 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/30 transition-all">
                    <button type="submit"
                            class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-60 disabled:cursor-not-allowed">
                        <span data-label-default>Subscribe</span>
                        <span data-label-loading class="hidden">Sending…</span>
                        <iconify-icon icon="lucide:arrow-right" width="14" aria-hidden="true"></iconify-icon>
                    </button>
                </form>
                <p data-form-message class="mt-3 text-xs text-neutral-500" role="status" aria-live="polite">
                    Free. 2 emails a day. Unsubscribe anytime.
                </p>
            </section>

            <!-- Back to archive -->
            <div class="mt-12 text-center">
                <a href="../newsletter.html" class="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors">
                    <iconify-icon icon="lucide:arrow-left" width="14" aria-hidden="true"></iconify-icon>
                    <span>All newsletters</span>
                </a>
            </div>
        </div>
    </article>

    <!-- Minimal footer (matches articles/*.html) -->
    <footer class="relative z-10 border-t border-white/10 bg-[#050505] mt-16">
        <div class="max-w-4xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-4">
            <p class="text-neutral-600 text-xs">© <span id="year">2026</span> Weekend MVP. Built to ship.</p>
            <div class="flex items-center gap-6 text-xs text-neutral-500">
                <a href="../newsletter.html" class="hover:text-white transition-colors">Newsletter</a>
                <a href="../articles.html" class="hover:text-white transition-colors">Articles</a>
                <a href="../starter-kit.html" class="hover:text-white transition-colors">Starter Kit</a>
                <a href="../privacy-policy.html" class="hover:text-white transition-colors">Privacy</a>
            </div>
        </div>
    </footer>

    <script>
        document.getElementById('year').textContent = new Date().getFullYear();

        // Same reusable subscribe handler used on newsletter.html
        document.querySelectorAll('form[data-newsletter-subscribe]').forEach((form) => {
            const msg = form.parentElement.querySelector('[data-form-message]');
            const btn = form.querySelector('button[type="submit"]');
            const labelDefault = form.querySelector('[data-label-default]');
            const labelLoading = form.querySelector('[data-label-loading]');
            const campaign = form.dataset.utmCampaign || 'newsletter-web';

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = form.querySelector('input[type="email"]').value.trim();
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    if (msg) { msg.textContent = 'Please enter a valid email.'; msg.classList.remove('text-neutral-500'); msg.classList.add('text-[#CC5500]'); }
                    return;
                }
                btn.disabled = true;
                labelDefault?.classList.add('hidden');
                labelLoading?.classList.remove('hidden');
                if (msg) { msg.textContent = 'Sending…'; msg.classList.remove('text-[#CC5500]'); msg.classList.add('text-neutral-500'); }

                try {
                    const res = await fetch('/api/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, utm_campaign: campaign, utm_source: 'newsletter-web', utm_medium: 'website' })
                    });
                    if (!res.ok) throw new Error('Subscribe failed');
                    form.reset();
                    if (msg) { msg.textContent = 'Check your inbox to confirm — you\'re in.'; msg.classList.remove('text-[#CC5500]'); msg.classList.add('text-white'); }
                    labelDefault && (labelDefault.textContent = 'Subscribed ✓');
                } catch (err) {
                    if (msg) { msg.textContent = 'Something went wrong. Try again in a moment.'; msg.classList.remove('text-neutral-500'); msg.classList.add('text-[#CC5500]'); }
                    btn.disabled = false;
                    labelLoading?.classList.add('hidden');
                    labelDefault?.classList.remove('hidden');
                }
            });
        });
    </script>
</body>
</html>
```

---

## Placeholder reference

| Placeholder     | Source                                                           | Example                                            |
| --------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| `{{title}}`     | Frontmatter `title` from the draft `.md` file                    | `Idea of the Day: AI Meeting Notes Cleaner`        |
| `{{description}}` | Frontmatter `subtitle` (used as meta description)              | `A $1K/mo weekend build that cleans up Zoom…`      |
| `{{subtitle}}`  | Frontmatter `subtitle`                                           | Same as above                                      |
| `{{slug}}`      | Draft filename stem (`2026-04-20-am`)                            | `2026-04-20-am`                                    |
| `{{date}}`      | Frontmatter `date` (ISO YYYY-MM-DD)                              | `2026-04-20`                                       |
| `{{dateLabel}}` | Formatted date                                                   | `Apr 20, 2026`                                     |
| `{{slot}}`      | `am` or `pm`                                                     | `am`                                               |
| `{{slotLabel}}` | `Idea of the Day` or `Builder Brief`                             | `Idea of the Day`                                  |
| `{{slotShort}}` | `AM` or `PM`                                                     | `AM`                                               |
| `{{bodyHtml}}`  | The BODY markdown section, converted to HTML (rules below)       | `<h1>Idea of the Day</h1><p>…</p>…`                |

---

## Markdown → HTML conversion rules

The draft `.md` file's `## BODY (paste into Beehiiv editor)` section (between that heading and `## BEEHIIV CHECKLIST`) is the source. Convert with these rules — keep it deterministic, no outside markdown library needed:

| Markdown                         | HTML output                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `# Heading`                      | `<h2 class="text-2xl font-medium text-white mb-6 tracking-tight">Heading</h2>` (top H1 becomes H2 since page H1 is the title) |
| `## Heading`                     | `<h3 class="text-xl font-medium text-white mb-4 mt-10 tracking-tight">Heading</h3>`             |
| `### Heading`                    | `<h4 class="text-lg font-medium text-white mb-3 mt-6">Heading</h4>`                             |
| `Plain paragraph.`               | `<p class="text-neutral-300 leading-relaxed">Plain paragraph.</p>`                              |
| `**bold**`                       | `<strong class="text-white font-medium">bold</strong>`                                          |
| `_italic_` or `*italic*`         | `<em>italic</em>`                                                                               |
| `[text](url)` standalone line, trailing `→` | `<a href="url" class="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all">text <iconify-icon icon="lucide:arrow-right" width="16" aria-hidden="true"></iconify-icon></a>` wrapped in `<div class="my-8 text-center">…</div>` |
| `[text](url)` inline             | `<a href="url" class="text-white underline decoration-neutral-600 underline-offset-2 hover:decoration-white transition-colors">text</a>` |
| `---`                            | `<hr class="my-8 border-0 h-px bg-white/10">`                                                   |
| Code fence ` ``` ... ``` `       | `<pre class="my-6 bg-[#0A0A0A] border border-white/[0.06] rounded-xl p-4 text-sm font-mono text-neutral-300 overflow-x-auto">…</pre>` |
| `- list item`                    | `<ul class="list-disc list-outside pl-6 space-y-2 text-neutral-300">...</ul>`                   |
| `1. ordered item`                | `<ol class="list-decimal list-outside pl-6 space-y-2 text-neutral-300">...</ol>`                |
| Blank line                       | paragraph break (separator only, no output)                                                     |

All HTML-special chars in the input get escaped (`&`, `<`, `>`). Link `href` values are not escaped, but are validated: must start with `http://`, `https://`, `/`, `#`, or `mailto:`.

---

## Step-by-step for the skill

When `/newsletter today` reaches step 5b, for each slot (`am` then `pm`):

1. Read the draft file `content/newsletter/{date}-{slot}.md`.
2. Parse the YAML frontmatter (keys: `date`, `slot`, `title`, `subtitle`, `scheduled_at_local`, `cta_url`).
3. Extract the block between `## BODY (paste into Beehiiv editor)` and the next `##` heading.
4. Convert that markdown to HTML using the rules above.
5. Load the page template (this file, between the first ``` ```html ``` and its closing ``` ``` ```).
6. Substitute all `{{...}}` placeholders.
7. Write to `newsletter/{date}-{slot}.html`.

Then, once per run (after both slots are written):

8. Run `node scripts/update-newsletter-archive.js` — regenerates `newsletter.html` card grid + ItemList.
9. Run `node scripts/inject-analytics.js newsletter/{date}-am.html newsletter/{date}-pm.html` — idempotent GA + Meta Pixel injection.
10. Append the two new URLs to `sitemap.xml` (see rules below).
11. Print the operator checklist (commit + push, then paste into Beehiiv).

---

## Sitemap update rules

For each newly-generated page, add an entry to `sitemap.xml` before `</urlset>`:

```xml
  <url>
    <loc>https://weekendmvp.app/newsletter/{{slug}}.html</loc>
    <lastmod>{{date}}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
```

Also update the `<lastmod>` on the `https://weekendmvp.app/newsletter.html` entry to today's date.

If the feed entry doesn't exist yet, insert it with `priority: 0.8` and `changefreq: daily`.

Idempotency: check if a `<loc>` for this slug already exists before appending. If it does, just update its `<lastmod>`.

---

## Do / Don't

- **Do** convert markdown deterministically. No AI involvement in the rendering — same input → same HTML every time.
- **Do** escape HTML-special characters in all text content.
- **Do** keep the email (markdown body) and web (HTML body) content identical. The web page is the email, rendered.
- **Don't** inject Beehiiv ad blocks into the web HTML. Ads are email-contract-only. The web page omits that section silently.
- **Don't** include the BEEHIIV CHECKLIST section in the web HTML. It's operator-only.
- **Don't** commit the draft `.md` files — they stay gitignored. Only `newsletter/*.html` + `newsletter.html` + `sitemap.xml` go to git.
