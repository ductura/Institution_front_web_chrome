// The only adapter of RhythmPort until SRV-0910 exists (WEB-0910): memory, no request.
import type { RhythmPayload, RhythmPort } from "./input-rhythm";

export type FakeRhythmPort = RhythmPort & {
  /** What the fake was sent, for tests and the demo. */
  readonly sent: readonly { readonly documentId: string; readonly payload: RhythmPayload }[];
  /** The teacher's switch. The student has no way to call it from the UI. */
  setRecording(documentId: string, on: boolean): void;
};

export function createFakeRhythmPort(initial = true): FakeRhythmPort {
  const off = new Set<string>();
  const sent: { documentId: string; payload: RhythmPayload }[] = [];
  return {
    sent,
    setRecording(documentId, on) {
      if (on) off.delete(documentId);
      else off.add(documentId);
    },
    async recording(documentId) {
      return initial && !off.has(documentId);
    },
    async send(documentId, payload) {
      if (off.has(documentId) || !initial) return;
      sent.push({ documentId, payload });
    },
  };
}
