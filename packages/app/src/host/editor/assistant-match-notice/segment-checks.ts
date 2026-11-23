// PIL-P1-PODUDARANJE-PROVJERA-WEB: when the student's editor sends a paragraph to
// work.assistant-match.post. The text the work opened with is the starting point; after each save
// the server confirms (SYNCED), every paragraph whose text changed since then is sent once, with the
// id of its block as `segmentRef`. Nothing is sent while the editor is not writable: a submitted
// work, a replay, a teacher's view or a tab whose session ended. An answer with matches asks the
// notice to read again. A failed send is tried after the next save; a 401 or 404 stops sending.
import type { Node as PmNode } from "@tiptap/pm/model";

import { changedSegments, type Segment, type SegmentPort } from "@/client/assistant-match";

import { NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/interop.ts";

/** At most this many paragraphs per save; the rest wait for the next one. */
export const MAX_SEGMENTS_PER_SAVE = 20;

/** Every text block of the document that carries its block id, in document order. */
export function segmentsOfDocument(doc: PmNode): readonly Segment[] {
  const out: Segment[] = [];
  doc.descendants((node) => {
    if (!node.isTextblock) return true;
    const ref = node.attrs[NODE_ID_ATTRIBUTE];
    if (typeof ref === "string" && ref !== "") out.push({ ref, text: node.textContent });
    return false;
  });
  return out;
}

export type SegmentSender = {
  /** The text the work opened with; only the first call counts. */
  readonly opened: (segments: readonly Segment[]) => void;
  /** The server confirmed a save: send what changed, if writing is still allowed. */
  readonly saved: (segments: readonly Segment[]) => Promise<void>;
};

export function createSegmentSender({ documentId, port, allowed, onMatched }: {
  documentId: string;
  port: SegmentPort;
  /** Read before every send: the editor is writable, the work not submitted, the session live. */
  allowed: () => boolean;
  onMatched: () => void;
}): SegmentSender {
  let known: Map<string, string> | null = null;
  let stopped = false;
  let running: Promise<void> | null = null;
  let waiting: readonly Segment[] | null = null;

  const round = async (segments: readonly Segment[]) => {
    if (known === null) return;
    let matched = false;
    for (const segment of changedSegments(segments, known).slice(0, MAX_SEGMENTS_PER_SAVE)) {
      if (stopped || !allowed()) break;
      const answer = await port(documentId, segment);
      if (answer.kind === "checked") {
        known.set(segment.ref, segment.text);
        if (answer.matches > 0) matched = true;
        continue;
      }
      if (answer.kind !== "failed") stopped = true;
      break;
    }
    if (matched && !stopped) onMatched();
  };

  return {
    opened: (segments) => {
      if (known !== null) return;
      known = new Map(segments.map((s) => [s.ref, s.text]));
    },
    saved: async (segments) => {
      if (stopped || known === null || !allowed()) return;
      if (running !== null) {
        waiting = segments;
        return running;
      }
      running = (async () => {
        let next: readonly Segment[] | null = segments;
        while (next !== null) {
          waiting = null;
          await round(next);
          next = waiting;
        }
      })().finally(() => { running = null; });
      return running;
    },
  };
}
