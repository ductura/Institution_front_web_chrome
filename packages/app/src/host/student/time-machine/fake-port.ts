// In-memory stand-in for the version routes (WEB-1504): invented versions and one invented comparison.
import type { TimeMachinePort, Version } from "./model";

export const FAKE_VERSIONS: readonly Version[] = [
  { kind: "checkpoint", revision: 3, savedMinute: "2026-11-20T09:15:00.000Z" },
  { kind: "submission", revision: 2, savedMinute: "2026-11-19T10:00:00.000Z" },
  { kind: "checkpoint", revision: 1, savedMinute: "2026-11-18T08:30:00.000Z" },
];

export function fakeTimeMachinePort(): TimeMachinePort & { readonly compares: readonly [number, number][] } {
  const compares: [number, number][] = [];
  return {
    compares,
    async versions() { return { kind: "ready", versions: FAKE_VERSIONS, partial: false }; },
    async compare(_id, from, to) {
      compares.push([from, to]);
      return {
        kind: "ready",
        blocks: [{ op: "changed", words: [
          { op: "same", text: "Izmišljeni " }, { op: "removed", text: "stari" }, { op: "added", text: "novi" }, { op: "same", text: " odlomak." },
        ] }],
        truncated: false,
      };
    },
  };
}
