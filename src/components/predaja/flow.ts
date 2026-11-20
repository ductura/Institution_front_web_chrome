/**
 * The submission flow's addresses and its hand-off of the declaration
 * (WEB-24, WEB-25). A plain module, not "use client", so server pages and
 * tests read the same values.
 *
 * The confirmation lives only in this browser (P-7) and only for one sign-in:
 * its key names the session's `sessionTag` (WEB-14c, new at every sign-in),
 * so after a sign-out the next person in the same tab finds nothing. Step 2
 * also hands the confirmation to step 3 in the address (`?izjava=<tag>`), so
 * a browser that refuses storage does not lose it on the way (§5 rule 11).
 * Step 3 takes the hand-off only for the session that is signed in now.
 */

export type Step = "tekst" | "izjava" | "pregled" | "slanje" | "potvrda";

/** The query parameter step 2 hands to step 3. */
export const DECLARED_PARAM = "izjava";

/**
 * The page of each step. `slanje` (WEB-26) and `potvrda` (WEB-27) are the
 * paths the plan gives the next steps, which branch from this one.
 */
export function stepHref(assignmentId: string, step: Step, declaredFor?: string): string {
  const base = `/rad/${encodeURIComponent(assignmentId)}`;
  if (step === "tekst") return base;
  const href = `${base}/predaja/${step}`;
  return declaredFor === undefined ? href : `${href}?${DECLARED_PARAM}=${encodeURIComponent(declaredFor)}`;
}

/** Where the confirmation is kept: per sign-in and per assignment. */
export function confirmationKey(sessionTag: string, assignmentId: string): string {
  return `ductura.predaja.izjava.${encodeURIComponent(sessionTag)}.${assignmentId}`;
}

/** Step 3: confirmed when kept for this sign-in, or handed over for this sign-in. */
export function isDeclared(sessionTag: string | null, kept: boolean, handedFor: string | undefined): boolean {
  if (sessionTag === null) return false;
  return kept || handedFor === sessionTag;
}
