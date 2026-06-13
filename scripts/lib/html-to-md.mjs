/**
 * Shared HTML → Markdown walker used by the one-time extraction scripts
 * (scripts/extract-idea-bodies.mjs and scripts/extract-articles-to-mdx.mjs).
 *
 * The functions here were lifted verbatim from extract-idea-bodies.mjs (U9)
 * so both extractors render identical markdown for the same markup. The only
 * extension point is `setHrefRewriter`, which lets each script map legacy
 * relative .html links onto its own Next.js route shape.
 */

export const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'button', 'iconify-icon', 'svg',
  'img', 'picture', 'source', 'iframe', 'form', 'input', 'select', 'textarea',
  'nav', 'footer', 'header', 'aside',
]);

export const INLINE_TAGS = new Set([
  'a', 'span', 'strong', 'b', 'em', 'i', 'code', 'br', 'small', 'sup', 'sub',
  'u', 'abbr', 'time', 'mark', 'label',
]);

export const cls = (el) => (el.attribs?.class || '');
export const hasClass = (el, name) => cls(el).split(/\s+/).includes(name);

/** Escape characters that would break MDX compilation in plain prose. */
export function escapeMdx(text) {
  // `<` starts JSX, `{` starts an expression. Backslash-escapes are valid MDX.
  return text.replace(/</g, '\\<').replace(/\{/g, '\\{');
}

export const collapse = (s) => s.replace(/\s+/g, ' ');

/**
 * Rewrites legacy relative idea links to the Next.js route shape — the
 * historical default from extract-idea-bodies.mjs. Article extraction swaps
 * this out via setHrefRewriter().
 */
function defaultHrefRewriter(href) {
  const rel = href.match(/^(?:\.\/)?([a-z0-9-]+)\.html$/i);
  if (rel) return `/ideas/${rel[1]}`;
  return href.replace(/^\/ideas\/([a-z0-9-]+)\.html$/i, '/ideas/$1');
}

let rewriteHref = defaultHrefRewriter;

/** Override how legacy hrefs are mapped to routes (per extraction script). */
export function setHrefRewriter(fn) {
  rewriteHref = fn ?? defaultHrefRewriter;
}

/** True for nodes that should be entirely ignored (buttons, icons, sr-only). */
export function isSkipped(node) {
  if (node.type !== 'tag') return false;
  if (SKIP_TAGS.has(node.tagName)) return true;
  if (hasClass(node, 'sr-only')) return true;
  return false;
}

/** Render inline content (text, links, emphasis) of a node to markdown. */
export function inline($, node) {
  if (node.type === 'text') return escapeMdx(collapse(node.data || ''));
  if (node.type !== 'tag') return '';
  if (isSkipped(node)) return '';
  const tag = node.tagName;
  const children = () => node.children.map((c) => inline($, c)).join('');
  switch (tag) {
    case 'br':
      return ' ';
    case 'a': {
      const text = collapse(children()).trim();
      let href = node.attribs?.href || '';
      if (!text) return '';
      if (!href || href.startsWith('#')) return text;
      href = rewriteHref(href);
      return `[${text}](${href})`;
    }
    case 'strong':
    case 'b': {
      const t = collapse(children()).trim();
      return t ? `**${t}**` : '';
    }
    case 'em':
    case 'i': {
      const t = collapse(children()).trim();
      return t ? `*${t}*` : '';
    }
    case 'code': {
      const t = collapse($(node).text()).trim();
      return t ? `\`${t}\`` : '';
    }
    default:
      return children();
  }
}

/** All inline text of an element (recursing through divs too), markdown inline. */
export function inlineAll($, el) {
  return collapse(
    el.children.map((c) => {
      if (c.type === 'text') return inline($, c);
      if (c.type !== 'tag') return '';
      if (isSkipped(c)) return '';
      if (INLINE_TAGS.has(c.tagName)) return inline($, c);
      return ` ${inlineAll($, c)} `;
    }).join(''),
  ).trim();
}

/** Raw text preserving author newlines — for prompt blocks / <pre>. */
export function rawText($, node, out = []) {
  if (node.type === 'text') { out.push(node.data || ''); return out; }
  if (node.type !== 'tag') return out;
  if (isSkipped(node)) return out;
  if (node.tagName === 'br') { out.push('\n'); return out; }
  for (const c of node.children) rawText($, c, out);
  return out;
}

/** Dedent + trim a preserved-newline text block. */
export function cleanBlockText($, el) {
  const raw = rawText($, el).join('');
  let lines = raw.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  lines = lines.map((l) => (l.trim() ? l.slice(min) : ''));
  // Collapse runs of blank lines.
  const result = [];
  for (const l of lines) {
    if (!l.trim() && result.length && !result[result.length - 1].trim()) continue;
    result.push(l);
  }
  return result.join('\n');
}

/** Fence a code block safely (longer fence if the body contains ```). */
export function fence(text) {
  let marker = '```';
  while (text.includes(marker)) marker += '`';
  return `${marker}text\n${text}\n${marker}`;
}

/** A `.prompt-box` div → bold label + fenced prompt text. */
export function renderPromptBox($, el) {
  const blocks = [];
  const label = $(el).find('h4').first();
  if (label.length) {
    const t = collapse(label.text()).trim();
    if (t) blocks.push(`**${escapeMdx(t)}**`);
  }
  const bodyParts = [];
  for (const child of el.children) {
    if (child.type !== 'tag' || isSkipped(child)) continue;
    if (child.tagName === 'h4') continue;
    const text = cleanBlockText($, child);
    if (text.trim()) bodyParts.push(text);
  }
  if (bodyParts.length) blocks.push(fence(bodyParts.join('\n\n')));
  return blocks;
}

export const isLabelEl = (el) =>
  /\buppercase\b/.test(cls(el)) && /tracking-(wide|widest)/.test(cls(el));
export const isTitleEl = (el) =>
  el.tagName === 'h4' ||
  /font-(semibold|bold|medium)\b/.test(cls(el)) ||
  /text-2xl/.test(cls(el));

/**
 * A "card" div inside a grid (competitor, pricing tier, tech-stack layer,
 * stat) → one compact markdown line: `**Title** (Label) — description`.
 */
export function renderCardItem($, el) {
  const titles = [];
  const labels = [];
  const descs = [];
  const walk = (node) => {
    if (node.type !== 'tag' || isSkipped(node)) return;
    const tag = node.tagName;
    if (tag === 'div' || tag === 'section') {
      // Header rows pair an h4/p title with a small span (e.g. price).
      for (const c of node.children) walk(c);
      return;
    }
    if (tag === 'span') {
      const t = inlineAll($, node);
      if (t) labels.push(t);
      return;
    }
    if (/^h[1-6]$/.test(tag) || tag === 'p') {
      const t = inlineAll($, node);
      if (!t) return;
      if (isLabelEl(node)) labels.push(t);
      else if (isTitleEl(node) && !titles.length) titles.push(t);
      else if (isTitleEl(node)) labels.push(t); // e.g. price under a tier name
      else descs.push(t);
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      $(node).children('li').each((_, li) => {
        const t = inlineAll($, $(li)[0]);
        if (t) descs.push(t);
      });
      return;
    }
    const t = inlineAll($, node);
    if (t) descs.push(t);
  };
  for (const c of el.children) walk(c);
  // Drop purely numeric badges (step-number circles like "1" / "01").
  const realLabels = labels.filter((l) => !/^\d{1,2}$/.test(l));
  labels.length = 0;
  labels.push(...realLabels);
  if (!titles.length && !descs.length && !labels.length) return '';
  if (!titles.length) return [labels.join(', '), descs.join(' ')].filter(Boolean).join(' — ');
  let line = `**${titles.join(' ')}**`;
  if (labels.length) line += ` (${labels.join(', ')})`;
  if (descs.length) line += ` — ${descs.join(' ')}`;
  return line;
}

/** ul/ol → markdown list. */
export function renderList($, el, ordered) {
  const items = [];
  $(el).children('li').each((i, li) => {
    const t = inlineAll($, li);
    if (t) items.push(ordered ? `${i + 1}. ${t}` : `- ${t}`);
  });
  return items.length ? [items.join('\n')] : [];
}

export function renderTable($, el) {
  const rows = [];
  $(el).find('tr').each((_, tr) => {
    const cells = [];
    $(tr).children('th,td').each((__, td) => cells.push(inlineAll($, td) || ' '));
    rows.push(cells);
  });
  if (!rows.length) return [];
  const lines = [`| ${rows[0].join(' | ')} |`, `| ${rows[0].map(() => '---').join(' | ')} |`];
  for (const r of rows.slice(1)) lines.push(`| ${r.join(' | ')} |`);
  return [lines.join('\n')];
}

/** Convert the block-level children of `container` into markdown blocks. */
export function renderBlocks($, container, blocks = []) {
  let buf = '';
  const flush = () => {
    const t = collapse(buf).trim();
    if (t) blocks.push(t);
    buf = '';
  };
  for (const node of container.children) {
    if (node.type === 'text') { buf += inline($, node); continue; }
    if (node.type !== 'tag') continue;
    if (isSkipped(node)) continue;
    const tag = node.tagName;
    if (INLINE_TAGS.has(tag)) { buf += inline($, node); continue; }
    flush();
    if (/^h[1-6]$/.test(tag)) {
      const t = collapse($(node).text()).trim();
      if (!t) continue;
      if (tag === 'h2') blocks.push(`## ${escapeMdx(t)}`);
      else if (tag === 'h3') blocks.push(`### ${escapeMdx(t)}`);
      else blocks.push(`**${escapeMdx(t)}**`);
      continue;
    }
    if (tag === 'p') {
      // Prompt body paragraphs are handled by renderPromptBox; a bare
      // font-mono paragraph outside a prompt-box still becomes a fence.
      if (/\bfont-mono\b/.test(cls(node))) {
        const text = cleanBlockText($, node);
        if (text.trim()) blocks.push(fence(text));
      } else {
        const t = inlineAll($, node);
        if (t) blocks.push(t);
      }
      continue;
    }
    if (tag === 'ul' || tag === 'ol') { blocks.push(...renderList($, node, tag === 'ol')); continue; }
    if (tag === 'pre') {
      const text = cleanBlockText($, node);
      if (text.trim()) blocks.push(fence(text));
      continue;
    }
    if (tag === 'blockquote') {
      const inner = renderBlocks($, node, []);
      if (inner.length) blocks.push(inner.join('\n\n').split('\n').map((l) => `> ${l}`).join('\n'));
      continue;
    }
    if (tag === 'table') { blocks.push(...renderTable($, node)); continue; }
    if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
      if (hasClass(node, 'prompt-box')) { blocks.push(...renderPromptBox($, node)); continue; }
      const elChildren = node.children.filter((c) => c.type === 'tag' && !isSkipped(c));
      // "How it works" step rows: a flex container of ≥2 div.flex-1 columns.
      const isStepRow =
        /\bflex\b/.test(cls(node)) &&
        elChildren.length >= 2 &&
        elChildren.every((c) => hasClass(c, 'flex-1'));
      if (/\bgrid\b/.test(cls(node)) || isStepRow) {
        const items = [];
        for (const child of elChildren) {
          const item = renderCardItem($, child);
          if (item) items.push(isStepRow ? `${items.length + 1}. ${item}` : `- ${item}`);
        }
        if (items.length) blocks.push(items.join('\n'));
        continue;
      }
      renderBlocks($, node, blocks);
      continue;
    }
    // Unknown block-level tag: keep its text so content is never lost.
    const t = inlineAll($, node);
    if (t) blocks.push(t);
  }
  flush();
  return blocks;
}
