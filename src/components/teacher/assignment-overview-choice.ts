// WEB-33 (N-17): which assignment the summary page shows. A plain module, not
// "use client": the server page calls it (review c.7026829856).

export type OverviewChoice = { readonly id: string; readonly title: string; readonly label: string };

/**
 * The assignment the page shows: the one asked for when it is one of the
 * teacher's, else the first; null when the teacher has none. An id that is not
 * the teacher's is never read.
 */
export function chooseAssignment(choices: readonly OverviewChoice[], asked: string | readonly string[] | undefined): OverviewChoice | null {
  return choices.find((choice) => choice.id === asked) ?? choices[0] ?? null;
}
