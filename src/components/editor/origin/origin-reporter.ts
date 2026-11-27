/**
 * PM1-R01 (F4-PM1-R01): after each revision the server confirms, the sheet
 * sends the ranges of origin of that revision (`work.origin-segments.post`),
 * so the teacher's Karta podrijetla, the composition and the thresholds have
 * something to read. One reporter per open sheet with evidence.
 *
 * - A revision is sent at most once, and never one older than the last sent
 *   (the route is append-only: a 409 means it has its ranges already).
 * - A failure changes nothing in the writing or the saving of the text; the
 *   next confirmed revision carries every range again.
 * - The sheet loaded at a revision the server has ranges for starts from them
 *   (`work.origin-segments.get`), so a reload does not lose the earlier marks.
 */

import type { Transaction } from "@tiptap/pm/state";

import type { OriginRecordAnswer, OriginSegmentsPort } from "@/client/origin-segments";

import { canonicalTextBlocks, OriginTracker, originOfSource } from "./origin-tracker";

export class OriginReporter {
  private readonly tracker = new OriginTracker();
  private lastSent = -1;
  private changed = false;
  private sending: Promise<unknown> = Promise.resolve();

  constructor(private readonly port: OriginSegmentsPort, private readonly documentId: string) {}

  /**
   * The sheet was loaded at `revision` with `document` and nothing owed (else
   * null): the server's ranges of that very revision become the start.
   */
  async seed(revision: number | null, document: unknown): Promise<void> {
    if (revision === null) return;
    const stored = await this.port.stored(this.documentId);
    if (stored.kind !== "ready" || stored.revision !== revision || stored.segments.length === 0) return;
    this.lastSent = Math.max(this.lastSent, revision);
    this.tracker.seedWith(canonicalTextBlocks(document), stored.segments);
  }

  /** One editor change with the source the evidence session gave it (null: none named). */
  note(transactions: readonly Transaction[], source: string | null): void {
    if (!transactions.some((tr) => tr.docChanged)) return;
    this.changed = true;
    this.tracker.apply(transactions, originOfSource(source));
  }

  /**
   * The server confirmed `revision`, whose document is `document`. Resolves
   * with the server's answer, or null when nothing was sent (no change since
   * the load, an older revision, no range that fits it).
   */
  confirmed(revision: number, document: unknown): Promise<OriginRecordAnswer | null> {
    const run = this.sending.then(() => this.send(revision, document));
    this.sending = run.catch(() => null);
    return run;
  }

  private async send(revision: number, document: unknown): Promise<OriginRecordAnswer | null> {
    if (!this.changed || revision <= this.lastSent) return null;
    const segments = this.tracker.segmentsFor(canonicalTextBlocks(document));
    if (segments.length === 0) return null;
    const answer = await this.port.record(this.documentId, revision, segments);
    if (answer.kind === "recorded" || answer.kind === "already") this.lastSent = Math.max(this.lastSent, revision);
    return answer;
  }
}
