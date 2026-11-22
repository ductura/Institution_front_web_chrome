// INT-16: before a submission, a newer version on this device that the server has not confirmed yet
// is named in a warning that does not block. Two choices: send the newest version first and then
// submit (the default), or submit the confirmed revision V<n>. Only a revision the server confirmed
// is ever submitted: the one of the work as read from the server, never a number of the journal.
// Pure: the journal, the server and the dialog come in as dependencies.

/** A revision the server confirmed: `revision` of evidence.open.post (`currentRevision`). */
export type Confirmed = { readonly documentId: string; readonly revision: number };

/** "latest": "Pošalji najprije zadnju verziju pa predaj" (default); "confirmed": "Predaj potvrđenu verziju V<n>". */
export type NewerChoice = "latest" | "confirmed";

export type NewerLocalDeps<T> = {
  /** Whether this device holds a newer version of the document the server has not confirmed; false when it cannot be read. */
  readonly hasNewer: (documentId: string) => Promise<boolean>;
  /**
   * Shows the warning and resolves with the choice; null when the student goes back. `notSent`: the
   * newest version did not reach the server after the last choice, so nothing was submitted.
   */
  readonly ask: (confirmed: Confirmed, notSent: boolean) => Promise<NewerChoice | null>;
  /** Sends the newest version and resolves with the revision the server confirmed for it; null when it did not arrive. */
  readonly sendLatest: (confirmed: Confirmed) => Promise<Confirmed | null>;
  /** The submission of exactly this confirmed revision. */
  readonly submitRevision: (target: Confirmed) => Promise<T>;
};

export type NewerLocalOutcome<T> =
  | { readonly kind: "submitted"; readonly target: Confirmed; readonly answer: T }
  /** The student went back from the warning: nothing was submitted. */
  | { readonly kind: "cancelled" };

/** A read that fails says "no newer version": the warning never holds a submission back. */
async function newerOf(hasNewer: (documentId: string) => Promise<boolean>, documentId: string): Promise<boolean> {
  try {
    return (await hasNewer(documentId)) === true;
  } catch {
    return false;
  }
}

/**
 * One submission with the check of INT-16. Without a newer version on this device no warning is
 * shown and the confirmed revision is submitted. With one, the student chooses; after
 * "Pošalji najprije zadnju verziju" only the revision the server confirmed for it is submitted; when
 * it does not arrive nothing is submitted and the warning is shown again.
 */
export async function submitConfirmed<T>(confirmed: Confirmed, deps: NewerLocalDeps<T>): Promise<NewerLocalOutcome<T>> {
  if (!(await newerOf(deps.hasNewer, confirmed.documentId))) {
    return { kind: "submitted", target: confirmed, answer: await deps.submitRevision(confirmed) };
  }
  // The warning stays until the student chooses something that can be submitted, or goes back.
  for (let notSent = false; ; notSent = true) {
    const choice = await deps.ask(confirmed, notSent);
    if (choice === null) return { kind: "cancelled" };
    if (choice === "confirmed") return { kind: "submitted", target: confirmed, answer: await deps.submitRevision(confirmed) };
    const latest = await deps.sendLatest(confirmed).catch(() => null);
    if (latest !== null && latest.documentId === confirmed.documentId && Number.isInteger(latest.revision) && latest.revision >= confirmed.revision) {
      return { kind: "submitted", target: latest, answer: await deps.submitRevision(latest) };
    }
  }
}

export type WaitDeps = {
  readonly hasNewer: (documentId: string) => Promise<boolean>;
  /** The work as the server has it now; null when it cannot be read. */
  readonly readConfirmed: () => Promise<Confirmed | null>;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
  readonly limitMs: number;
  readonly everyMs: number;
};

/**
 * "Pošalji najprije zadnju verziju": waits, within a limit, until this device holds nothing the
 * server lacks, then reads the revision the server confirmed. The newest version is sent by the
 * workspace's own saver; this page never sends text of its own. Null at the limit.
 */
export async function waitForLatest(confirmed: Confirmed, deps: WaitDeps): Promise<Confirmed | null> {
  const until = deps.now() + deps.limitMs;
  for (;;) {
    if (!(await newerOf(deps.hasNewer, confirmed.documentId))) {
      const read = await deps.readConfirmed().catch(() => null);
      if (read !== null && read.documentId === confirmed.documentId && read.revision >= confirmed.revision) return read;
    }
    if (deps.now() + deps.everyMs > until) return null;
    await deps.sleep(deps.everyMs);
  }
}
