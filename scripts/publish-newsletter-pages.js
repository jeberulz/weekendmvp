#!/usr/bin/env node
/**
 * publish-newsletter-pages.js
 *
 * Step 5b of the `/newsletter today` flow: read a draft .md, convert its
 * BODY section to HTML per the rules in
 * `.claude/skills/newsletter/web-publish.md`, and write the static page to
 * `newsletter/{date}-{slot}.html`.
 *
 * Usage:  node scripts/publish-newsletter-pages.js <draft-md-path> [...]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'newsletter');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

function parseFrontmatter(md) {
  if (!md.startsWith('---\n')) return { fm: {}, rest: md };
  const end = md.indexOf('\n---', 4);
  if (end === -1) return { fm: {}, rest: md };
  const raw = md.slice(4, end);
  const rest = md.slice(end + 4).replace(/^\n/, '');
  const fm = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Za-z_][\w]*):\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[m[1]] = val;
  }
  return { fm, rest };
}

function extractBody(md) {
  const startMarker = '## BODY (paste into Beehiiv editor)';
  const endMarker = '## BEEHIIV CHECKLIST';
  const start = md.indexOf(startMarker);
  if (start === -1) throw new Error('BODY section not found');
  const after = md.indexOf('\n', start) + 1;
  const end = md.indexOf(endMarker, after);
  const body = end === -1 ? md.slice(after) : md.slice(after, end);
  return body.trim();
}

function renderInline(text) {
  // Escape first, then apply inline substitutions using safe tokens.
  let out = escapeHtml(text);

  // Inline code `...`
  out = out.replace(/`([^`]+)`/g, (_, code) =>
    `<code class="px-1.5 py-0.5 bg-white/[0.06] rounded text-[0.95em] font-mono text-neutral-200">${code}</code>`
  );

  // Bold **...**
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong class="text-white font-medium">$1</strong>');

  // Italic _..._  or *...*
  out = out.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^\w_])_([^_\n]+)_/g, '$1<em>$2</em>');

  // Inline links [text](url) — run after bold/italic so labels may include them.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
    if (!/^(https?:|\/|#|mailto:)/.test(href)) return match;
    return `<a href="${href}" class="text-white underline decoration-neutral-600 underline-offset-2 hover:decoration-white transition-colors">${label}</a>`;
  });

  return out;
}

function renderBlock(buf) {
  const trimmed = buf.trim();
  if (!trimmed) return '';
  return `<p class="text-neutral-300 leading-relaxed">${renderInline(trimmed)}</p>`;
}

function renderList(items, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const cls = ordered
    ? 'list-decimal list-outside pl-6 space-y-2 text-neutral-300'
    : 'list-disc list-outside pl-6 space-y-2 text-neutral-300';
  const lis = items.map((it) => `<li class="leading-relaxed">${renderInline(it)}</li>`).join('');
  return `<${tag} class="${cls}">${lis}</${tag}>`;
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let paraBuf = [];
  let listBuf = [];
  let listOrdered = false;
  let inCode = false;
  let codeBuf = [];
  let codeLang = '';
  let inBlockquote = false;
  let quoteBuf = [];

  function flushPara() {
    if (paraBuf.length) {
      out.push(renderBlock(paraBuf.join(' ')));
      paraBuf = [];
    }
  }
  function flushList() {
    if (listBuf.length) {
      out.push(renderList(listBuf, listOrdered));
      listBuf = [];
    }
  }
  function flushQuote() {
    if (quoteBuf.length) {
      const inner = quoteBuf.map((l) => renderInline(l)).join('<br>');
      out.push(
        `<blockquote class="border-l-2 border-white/20 pl-4 my-6 text-neutral-400 italic">${inner}</blockquote>`
      );
      quoteBuf = [];
      inBlockquote = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inCode) {
      if (/^```/.test(line)) {
        const content = codeBuf.join('\n');
        out.push(
          `<pre class="my-6 bg-[#0A0A0A] border border-white/[0.06] rounded-xl p-4 text-sm font-mono text-neutral-300 overflow-x-auto"><code>${escapeHtml(content)}</code></pre>`
        );
        codeBuf = [];
        codeLang = '';
        inCode = false;
      } else {
        codeBuf.push(line);
      }
      continue;
    }

    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      flushPara();
      flushList();
      flushQuote();
      inCode = true;
      codeLang = fenceMatch[1];
      continue;
    }

    // Blank line
    if (!line.trim()) {
      flushPara();
      flushList();
      flushQuote();
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      flushPara();
      flushList();
      flushQuote();
      out.push('<hr class="my-8 border-0 h-px bg-white/10">');
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      flushQuote();
      const level = h[1].length;
      const txt = renderInline(h[2].trim());
      if (level === 1) {
        out.push(`<h2 class="text-2xl font-medium text-white mb-6 tracking-tight">${txt}</h2>`);
      } else if (level === 2) {
        out.push(`<h3 class="text-xl font-medium text-white mb-4 mt-10 tracking-tight">${txt}</h3>`);
      } else {
        out.push(`<h4 class="text-lg font-medium text-white mb-3 mt-6">${txt}</h4>`);
      }
      continue;
    }

    // Blockquote
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushPara();
      flushList();
      inBlockquote = true;
      quoteBuf.push(q[1]);
      continue;
    } else if (inBlockquote) {
      flushQuote();
    }

    // Unordered list
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (listBuf.length && listOrdered) flushList();
      listOrdered = false;
      listBuf.push(ul[1]);
      continue;
    }

    // Ordered list
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      if (listBuf.length && !listOrdered) flushList();
      listOrdered = true;
      listBuf.push(ol[1]);
      continue;
    }

    // Standalone CTA button line: [text →](url)
    const btn = line.match(/^\[([^\]]*→[^\]]*)\]\(([^)]+)\)\s*$/);
    if (btn) {
      flushPara();
      flushList();
      flushQuote();
      const href = btn[2];
      if (/^(https?:|\/|#|mailto:)/.test(href)) {
        const label = btn[1].replace(/\s*→\s*$/, '').trim();
        out.push(
          `<div class="my-8 text-center"><a href="${href}" class="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all">${escapeHtml(label)} <iconify-icon icon="lucide:arrow-right" width="16" aria-hidden="true"></iconify-icon></a></div>`
        );
        continue;
      }
    }

    // Default: paragraph line
    flushList();
    flushQuote();
    paraBuf.push(line);
  }

  if (inCode && codeBuf.length) {
    out.push(
      `<pre class="my-6 bg-[#0A0A0A] border border-white/[0.06] rounded-xl p-4 text-sm font-mono text-neutral-300 overflow-x-auto"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`
    );
  }
  flushPara();
  flushList();
  flushQuote();

  return out.join('\n                ');
}

function formatDateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function renderPage({ fm, bodyHtml, slug }) {
  const slot = fm.slot;
  const slotLabel = slot === 'am' ? 'Idea of the Day' : 'Builder Brief';
  const slotShort = slot.toUpperCase();
  const title = fm.title;
  const description = fm.subtitle;
  const date = fm.date;
  const dateLabel = formatDateLabel(date);

  return `<!DOCTYPE html>
<html lang="en" class="antialiased dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} | Weekend MVP Newsletter</title>
    <meta name="description" content="${escapeAttr(description)}">
    <meta name="author" content="John Iseghohi">

    <meta property="og:type" content="article">
    <meta property="og:url" content="https://weekendmvp.app/newsletter/${slug}.html">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:image" content="https://weekendmvp.app/image/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://weekendmvp.app/newsletter/${slug}.html">
    <meta property="twitter:title" content="${escapeAttr(title)}">
    <meta property="twitter:description" content="${escapeAttr(description)}">
    <meta property="twitter:image" content="https://weekendmvp.app/image/og-image.png">

    <link rel="canonical" href="https://weekendmvp.app/newsletter/${slug}.html">

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
      "headline": ${JSON.stringify(title)},
      "description": ${JSON.stringify(description)},
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
      "datePublished": "${date}",
      "dateModified": "${date}",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "https://weekendmvp.app/newsletter/${slug}.html"
      },
      "image": "https://weekendmvp.app/image/og-image.png"
    }
    </script>
</head>
<body class="relative min-h-screen overflow-x-hidden selection:bg-white/20 selection:text-white bg-[#050505]">

    <div class="fixed inset-0 pointer-events-none z-0 grid-lines"></div>

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

    <article data-nl-slot="${slot}" class="relative z-10 pt-32 pb-24">
        <div class="max-w-2xl mx-auto px-6">

            <nav class="mb-8 text-xs text-neutral-500" aria-label="Breadcrumb">
                <a href="../index.html" class="hover:text-white transition-colors">Home</a>
                <span class="mx-2">/</span>
                <a href="../newsletter.html" class="hover:text-white transition-colors">Newsletter</a>
                <span class="mx-2">/</span>
                <span class="text-neutral-400">${dateLabel} — ${slotShort}</span>
            </nav>

            <header class="mb-16">
                <div class="flex items-center gap-3 mb-6">
                    <span class="px-2 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">${slotLabel}</span>
                    <span class="text-neutral-600 text-xs">•</span>
                    <time class="text-neutral-600 text-xs" datetime="${date}">${dateLabel}</time>
                </div>
                <h1 class="text-4xl md:text-5xl font-medium text-white tracking-tight leading-[1.1] mb-6">${escapeHtml(title)}</h1>
                <p class="text-xl text-neutral-400 font-light leading-relaxed">${escapeHtml(description)}</p>
            </header>

            <div class="prose-nl text-neutral-300 leading-relaxed space-y-6">
                ${bodyHtml}
            </div>

            <div class="my-16 p-8 bg-white/[0.02] border border-white/10 rounded-2xl text-center">
                <p class="text-neutral-400 text-sm mb-4">Want more ideas like this?</p>
                <a href="../startup-ideas.html" class="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all">
                    <span>Browse 45+ startup ideas</span>
                    <iconify-icon icon="lucide:arrow-right" width="16" aria-hidden="true"></iconify-icon>
                </a>
            </div>

            <section class="mt-16 p-8 bg-white/[0.02] border border-white/10 rounded-2xl">
                <h2 class="text-xl md:text-2xl font-medium text-white tracking-tight mb-2">Get the next one in your inbox</h2>
                <p class="text-sm text-neutral-400 mb-6">Free. 2 emails a day. Unsubscribe anytime.</p>
                <form data-newsletter-subscribe
                      data-utm-campaign="newsletter-web-${slot}"
                      class="flex flex-col sm:flex-row gap-2"
                      novalidate>
                    <label for="nl-${slug}-email" class="sr-only">Email address</label>
                    <input
                        type="email"
                        id="nl-${slug}-email"
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

            <div class="mt-12 text-center">
                <a href="../newsletter.html" class="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors">
                    <iconify-icon icon="lucide:arrow-left" width="14" aria-hidden="true"></iconify-icon>
                    <span>All newsletters</span>
                </a>
            </div>
        </div>
    </article>

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

        document.querySelectorAll('form[data-newsletter-subscribe]').forEach((form) => {
            const msg = form.parentElement.querySelector('[data-form-message]');
            const btn = form.querySelector('button[type="submit"]');
            const labelDefault = form.querySelector('[data-label-default]');
            const labelLoading = form.querySelector('[data-label-loading]');
            const campaign = form.dataset.utmCampaign || 'newsletter-web';

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = form.querySelector('input[type="email"]').value.trim();
                if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
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
                    if (msg) { msg.textContent = 'Check your inbox to confirm — you\\'re in.'; msg.classList.remove('text-[#CC5500]'); msg.classList.add('text-white'); }
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
`;
}

function publish(draftPath) {
  const md = fs.readFileSync(draftPath, 'utf8');
  const { fm } = parseFrontmatter(md);
  if (!fm.date || !fm.slot || !fm.title || !fm.subtitle) {
    throw new Error(`Missing frontmatter in ${draftPath} (need date, slot, title, subtitle)`);
  }
  const slug = `${fm.date}-${fm.slot}`;
  const body = extractBody(md);
  const bodyHtml = mdToHtml(body);
  const page = renderPage({ fm, bodyHtml, slug });
  const outPath = path.join(OUT_DIR, `${slug}.html`);
  fs.writeFileSync(outPath, page);
  console.log(`✓ Wrote ${path.relative(ROOT, outPath)}`);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/publish-newsletter-pages.js <draft-md-path> [...]');
  process.exit(1);
}
for (const a of args) publish(path.resolve(a));
