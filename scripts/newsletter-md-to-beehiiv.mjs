#!/usr/bin/env node
/**
 * Convert a /newsletter author .md draft's BODY into Beehiiv editor HTML
 * (the Tiptap parse contract used by the Beehiiv MCP `save_post` /
 * `edit_post_content`). Implements the deterministic mapping documented in
 * .claude/skills/newsletter/beehiiv-publish.md.
 *
 * Output: a JSON object { title, subtitle, slot, date, slug, html } on stdout,
 * which the /newsletter skill passes to `save_post` (title, subtitle,
 * email_settings, html_content). The skill — not this script — makes the MCP
 * call, since MCP tools are only callable from the agent.
 *
 * Usage:
 *   node scripts/newsletter-md-to-beehiiv.mjs <author-md-path>
 *     --html   print only the HTML body (skip the JSON envelope)
 *
 * Node shapes (see beehiiv-publish.md for the full table):
 *   # / ## / ###          -> <h1|h2|h3>
 *   **LABEL** (own line)   -> <p><strong>LABEL</strong></p>
 *   paragraph              -> <p>…</p>  (inline **bold**, *italic*, [text](url))
 *   > quote                -> <blockquote><p>…</p></blockquote>
 *   - item / 1. item       -> <ul|ol><li><p>…</p></li></ul|ol>
 *   ---                    -> <div data-type="horizontalRule"><hr></div>
 *   [label →](url) own line-> <div class="node-button"><a data-type="button" …>label</a></div>
 *   ![alt](url) own line   -> <figure data-type="imageBlock" data-src data-alt …></figure>
 *   ``` fenced ```         -> <pre><code class="language-…">…</code></pre>
 *
 * Beehiiv liquid merge tags ({{email}}, {{first_name|there}}) and href query
 * params are preserved verbatim — hrefs are never HTML-escaped.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const htmlOnly = argv.includes('--html');
const file = argv.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: node scripts/newsletter-md-to-beehiiv.mjs <author-md-path> [--html]');
  process.exit(1);
}

const BODY_START = '## BODY (paste into Beehiiv editor)';
const BODY_END = '## BEEHIIV CHECKLIST';
const VALID_HREF = /^(https?:\/\/|\/|#|mailto:)/;

function extractBody(md) {
  const start = md.indexOf(BODY_START);
  if (start === -1) throw new Error(`BODY section not found ("${BODY_START}")`);
  const after = md.indexOf('\n', start) + 1;
  const end = md.indexOf(BODY_END, after);
  return (end === -1 ? md.slice(after) : md.slice(after, end)).trim();
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

function assertHref(url) {
  if (!VALID_HREF.test(url)) throw new Error(`unsafe href (must start http(s):// / # mailto:): ${url}`);
  return url; // never escaped — preserves &e={{email}} etc.
}

/** Inline markdown -> HTML. Escapes literal text; preserves link hrefs verbatim. */
function inline(text) {
  const out = [];
  const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = linkRe.exec(text))) {
    out.push(emphasis(text.slice(last, m.index)));
    out.push(`<a href="${assertHref(m[2])}">${emphasis(m[1])}</a>`);
    last = linkRe.lastIndex;
  }
  out.push(emphasis(text.slice(last)));
  return out.join('');
}

/** Escape, then apply bold/italic on a non-link text segment. */
function emphasis(seg) {
  let s = esc(seg);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w])_(?!\s)([^_]+?)_(?![\w])/g, '$1<em>$2</em>');
  return s;
}

function convert(body) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;

  const flushList = (tag, items) =>
    html.push(`<${tag}>${items.map((it) => `<li><p>${inline(it)}</p></li>`).join('')}</${tag}>`);

  while (i < lines.length) {
    let line = lines[i];
    const t = line.trim();

    if (t === '') { i++; continue; }

    // Fenced code block
    if (/^```/.test(t)) {
      const lang = t.replace(/^```/, '').trim() || 'text';
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]);
      i++; // closing fence
      html.push(`<pre><code class="language-${escAttr(lang)}">${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Divider
    if (t === '---') { html.push('<div data-type="horizontalRule"><hr></div>'); i++; continue; }

    // Standalone image -> imageBlock
    let mm = t.match(/^!\[([^\]]*)\]\(([^()\s]+)\)$/);
    if (mm) {
      html.push(
        `<figure data-type="imageBlock" data-src="${escAttr(assertHref(mm[2]))}" data-alt="${escAttr(mm[1])}" data-align="center" data-width="100%"></figure>`,
      );
      i++;
      continue;
    }

    // Standalone CTA button: [label →](url)
    mm = t.match(/^\[([^\]]*→[^\]]*)\]\(([^()\s]+)\)$/);
    if (mm) {
      const label = mm[1].replace(/\s*→\s*$/, '').trim();
      html.push(
        `<div class="node-button"><a data-type="button" href="${assertHref(mm[2])}" data-alignment="center" data-size="normal">${emphasis(label)}</a></div>`,
      );
      i++;
      continue;
    }

    // Heading
    mm = t.match(/^(#{1,3})\s+(.*)$/);
    if (mm) {
      const lvl = mm[1].length;
      html.push(`<h${lvl}>${inline(mm[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // Blockquote (consecutive > lines -> one blockquote, each line a <p>)
    if (/^>\s?/.test(t)) {
      const ps = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        ps.push(`<p>${inline(lines[i].trim().replace(/^>\s?/, ''))}</p>`);
        i++;
      }
      html.push(`<blockquote>${ps.join('')}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(t)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      flushList('ul', items);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(t)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      flushList('ol', items);
      continue;
    }

    // Bold-only label line -> emphasized paragraph (not a heading)
    // Otherwise a normal paragraph.
    html.push(`<p>${inline(t)}</p>`);
    i++;
  }

  return html.join('\n');
}

const raw = fs.readFileSync(path.resolve(file), 'utf8');
const { data: fm, content } = matter(raw);
const html = convert(extractBody(content));

if (htmlOnly) {
  process.stdout.write(html);
} else {
  const date = String(fm.date ?? '').slice(0, 10);
  const slug = `${date}-${fm.slot}`;
  process.stdout.write(
    JSON.stringify(
      { title: String(fm.title), subtitle: String(fm.subtitle), slot: fm.slot, date, slug, html },
      null,
      2,
    ),
  );
}
