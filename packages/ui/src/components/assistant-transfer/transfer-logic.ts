/** The two texts split around the one stretch that differs, by code point. */
export type ChangedSpan = {
  prefix: string;
  removed: string;
  added: string;
  suffix: string;
};

/**
 * The longest common start and end of `before` and `after`, and what lies between them on
 * each side. Joining prefix + removed + suffix gives `before` back exactly, and prefix +
 * added + suffix gives `after`; a surrogate pair is never split. The changed stretch is widened
 * to whole words, so „tri” → „četiri” marks both words rather than their differing letters.
 */
export function changedSpan(before: string, after: string): ChangedSpan {
  const a = Array.from(before);
  const b = Array.from(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end += 1;
  if (start < a.length || start < b.length) {
    while (start > 0 && !isSpace(a[start - 1])) start -= 1;
    while (end > 0 && !isSpace(a[a.length - end])) end -= 1;
  }
  return {
    prefix: a.slice(0, start).join(""),
    removed: a.slice(start, a.length - end).join(""),
    added: b.slice(start, b.length - end).join(""),
    suffix: a.slice(a.length - end).join(""),
  };
}

function isSpace(char: string | undefined): boolean {
  return char !== undefined && /\s/u.test(char);
}
