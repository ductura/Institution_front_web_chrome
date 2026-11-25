// ED-30 (P2-1a): the toolbar folds by width. While its tools take more than one row, the least needed tool still
// on the bar goes to "Više" (the prototype's fit(), weights TL[id][3] in toolbar2.js); the paragraph style never goes.

/** How much a tool is needed on the bar: the lower, the sooner it goes to "Više". */
export const FIT_WEIGHT: Readonly<Record<string, number>> = {
  redo: 20, quote: 24, bulletList: 25, numberedList: 25, italic: 44, bold: 45, undo: 60,
};
const DEFAULT_WEIGHT = 50;

/** The next tool to fold, among those on the bar and not yet folded; null when none is left. */
export function nextToFold(onBar: readonly string[], folded: readonly string[]): string | null {
  const left = onBar.filter((id) => !folded.includes(id));
  if (left.length === 0) return null;
  const weight = (id: string) => FIT_WEIGHT[id] ?? DEFAULT_WEIGHT;
  return left.reduce((least, id) => (weight(id) < weight(least) ? id : least));
}

/** Whether boxes laid out in a wrapping row went onto a second row (their tops, in order). */
export function wrapsToSecondRow(tops: readonly number[]): boolean {
  const first = tops[0];
  return first !== undefined && tops.some((y) => y > first + 2);
}
