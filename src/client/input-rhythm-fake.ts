// The memory adapter of RhythmPort for tests and the demo (WEB-0910): no request.
import type { RhythmPayload, RhythmPort, RhythmSettingState } from "./input-rhythm";

export type FakeRhythmPort = RhythmPort & {
  /** What the fake was sent and still keeps, for tests and the demo. */
  readonly sent: readonly { readonly documentId: string; readonly payload: RhythmPayload }[];
  /** The teacher's switch. The student has no way to call it from the UI. */
  setRecording(documentId: string, on: boolean): void;
};

export function createFakeRhythmPort(initial = true): FakeRhythmPort {
  const off = new Set<string>();
  const set = new Set<string>();
  const sent: { documentId: string; payload: RhythmPayload }[] = [];
  const on = (documentId: string) => initial && !off.has(documentId);
  return {
    sent,
    setRecording(documentId, next) {
      set.add(documentId);
      if (next) off.delete(documentId);
      else off.add(documentId);
    },
    async recording(documentId) {
      return on(documentId);
    },
    async setting(documentId) {
      const state: RhythmSettingState = set.has(documentId)
        ? { enabled: on(documentId), level: "assignment", changedBy: { role: "teacher", name: null }, changedAt: "2026-11-23T08:00:00.000Z" }
        : { enabled: initial, level: "default", changedBy: null, changedAt: null };
      return { kind: "ready", state };
    },
    async erase(documentId) {
      let count = 0;
      for (let i = sent.length - 1; i >= 0; i -= 1) {
        if (sent[i]!.documentId !== documentId) continue;
        count += sent[i]!.payload.bursts.length;
        sent.splice(i, 1);
      }
      return { kind: "deleted", count };
    },
    async send(documentId, payload) {
      if (!on(documentId)) return;
      sent.push({ documentId, payload });
    },
  };
}
