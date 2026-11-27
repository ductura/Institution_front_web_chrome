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

import { canonicalTextBlocks, OriginTracker, originOfSource, type FrozenOrigins } from "./origin-tracker";

export class OriginReporter {
  private readonly tracker = new OriginTracker();
  private lastSent = -1;
  /** The newest revision taken for sending; an older or equal one is not taken again. */
  private lastTaken = -1;
  private changed = false;
  private sending: Promise<unknown> = Promise.resolve();
  private seeding: Promise<void> = Promise.resolve();

  constructor(private readonly port: OriginSegmentsPort, private readonly documentId: string) {}

  /**
   * The sheet was loaded at `revision` with `document` and nothing owed (else
   * null): the server's ranges of that very revision become the start, also
   * when they arrive after the first change. A send waits for this read.
   */
  seed(revision: number | null, document: unknown): Promise<void> {
    this.seeding = this.readSeed(revision, document).catch(() => { this.tracker.dropSeed(); });
    return this.seeding;
  }

  /** One editor change with the source the evidence session gave it (null: none named). */
  note(transactions: readonly Transaction[], source: string | null): void {
    if (!transactions.some((tr) => tr.docChanged)) return;
    this.changed = true;
    this.tracker.apply(transactions, originOfSource(source));
  }

  /**
   * The server confirmed `revision`, whose document is `document`. The ranges
   * are taken now, so what is typed while an earlier send is on its way never
   * changes them. Resolves with the server's answer, or null when nothing was
   * sent (no change since the load, an older revision, no range that fits it).
   */
  confirmed(revision: number, document: unknown): Promise<OriginRecordAnswer | null> {
    if (!this.changed || revision <= this.lastTaken) return Promise.resolve(null);
    this.lastTaken = revision;
    const frozen = this.tracker.freeze();
    const blocks = canonicalTextBlocks(document);
    const run = this.sending.then(async () => {
      await this.seeding;
      return this.send(revision, frozen, blocks);
    });
    this.sending = run.catch(() => null);
    return run;
  }

  private async readSeed(revision: number | null, document: unknown): Promise<void> {
    if (revision === null) { this.tracker.dropSeed(); return; }
    const stored = await this.port.stored(this.documentId);
    if (stored.kind !== "ready" || stored.revision !== revision || stored.segments.length === 0) { this.tracker.dropSeed(); return; }
    this.lastSent = Math.max(this.lastSent, revision);
    this.tracker.seedWith(canonicalTextBlocks(document), stored.segments);
  }

  private async send(revision: number, frozen: FrozenOrigins, blocks: ReadonlyMap<string, string>): Promise<OriginRecordAnswer | null> {
    if (revision <= this.lastSent) return null;
    const segments = this.tracker.segmentsFrom(frozen, blocks);
    if (segments.length === 0) return null;
    const answer = await this.port.record(this.documentId, revision, segments);
    if (answer.kind === "recorded" || answer.kind === "already") this.lastSent = Math.max(this.lastSent, revision);
    return answer;
  }
}
