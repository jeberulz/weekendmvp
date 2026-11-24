/**
 * WP100. A word-level diff for the "A sharper version" card: which words of the
 * suggestion are new, so the founder sees at a glance what changed and that
 * the rest is still theirs. Pure; tokens keep their trailing spaces so the
 * parts join back to the exact suggestion.
 */

export type DiffPart = { readonly text: string; readonly added: boolean };

function tokens(text: string): string[] {
  return text.match(/\S+\s*/gu) ?? [];
}

function key(token: string): string {
  return token.trim().toLowerCase().replace(/[.,;:!?'"]+$/u, "");
}

/** The suggestion split into kept and added runs (longest common subsequence on words). */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before).map(key);
  const b = tokens(after);
  const bk = b.map(key);
  // lcs[i][j]: common words in a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === bk[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (text: string, added: boolean) => {
    const last = parts.at(-1);
    if (last !== undefined && last.added === added) parts[parts.length - 1] = { text: last.text + text, added };
    else parts.push({ text, added });
  };
  let i = 0;
  let j = 0;
  while (j < b.length) {
    if (i < a.length && a[i] === bk[j]) {
      push(b[j], false);
      i += 1;
      j += 1;
    } else if (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1]) {
      i += 1;
    } else {
      push(b[j], true);
      j += 1;
    }
  }
  return parts;
}
