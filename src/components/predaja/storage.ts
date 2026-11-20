/**
 * What the submission flow keeps in this tab (never on the server, P-7).
 * Every key starts with PREFIX so that a sign-out removes all of them at once;
 * steps 3 and 4 (WEB-25, WEB-26) build theirs with `submissionKey`.
 */
export const SUBMISSION_STORAGE_PREFIX = "ductura.predaja.";

/**
 * `ductura.predaja.<session>.<assignmentId>.<step>` for this session and
 * assignment; null without a known session, so nothing is kept.
 */
export function submissionKey(session: string | null, assignmentId: string, step: string): string | null {
  return session === null ? null : `${SUBMISSION_STORAGE_PREFIX}${session}.${assignmentId}.${step}`;
}

/** Removes every `ductura.predaja.*` key from this tab's storage; storage that refuses is ignored. */
export function clearSubmissionStorage(): void {
  try {
    const storage = window.sessionStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key !== null && key.startsWith(SUBMISSION_STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Without storage there is nothing to clear.
  }
}
