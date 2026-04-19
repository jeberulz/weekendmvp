#!/usr/bin/env node
/**
 * Resolves internal href/src in HTML and reports missing files.
 * Run: node scripts/check-internal-links.js
 */
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const root = path.resolve(__dirname, '..');

function resolveFrom(baseFile, target) {
  if (!target || target.startsWith('data:') || target.startsWith('mailto:') || target.startsWith('tel:')) {
    return null;
  }
  if (/^https?:\/\//i.test(target) || target.startsWith('//')) {
    return null;
  }
  const clean = target.split('#')[0].split('?')[0];
  if (!clean) return null;

  const dir = path.dirname(baseFile);
  let resolved = path.resolve(dir, clean);

  if (fs.existsSync(resolved)) {
    const st = fs.statSync(resolved);
    if (st.isDirectory()) {
      resolved = path.join(resolved, 'index.html');
    }
  } else if (!path.extname(resolved)) {
    const withIndex = path.join(resolved, 'index.html');
    if (fs.existsSync(withIndex)) {
      resolved = withIndex;
    }
  }

  const normalizedRoot = root.endsWith(path.sep) ? root : root + path.sep;
  if (!resolved.startsWith(normalizedRoot) && resolved !== root) {
    return null;
  }
  return resolved;
}

async function main() {
  const files = await glob('**/*.html', {
    cwd: root,
    ignore: ['node_modules/**'],
    nodir: true,
  });

  const attrRe = /\b(?:href|src)=["']([^"']+)["']/g;
  const broken = [];

  for (const rel of files) {
    const full = path.join(root, rel);
    const html = fs.readFileSync(full, 'utf8');
    let m;
    while ((m = attrRe.exec(html)) !== null) {
      const target = m[1].trim();
      if (target.includes('{{') || target.includes('}}')) continue;
      const resolvedPath = resolveFrom(full, target);
      if (!resolvedPath) continue;
      if (!fs.existsSync(resolvedPath)) {
        broken.push({
          from: rel,
          ref: target,
          expected: path.relative(root, resolvedPath),
        });
      }
    }
  }

  if (broken.length === 0) {
    console.log('OK: no broken internal href/src targets');
    process.exit(0);
  }

  console.warn(`Broken internal links (${broken.length}):`);
  for (const b of broken) {
    console.warn(`  ${b.from} → ${b.ref} (missing: ${b.expected})`);
  }
  if (process.env.STRICT === '1') {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
