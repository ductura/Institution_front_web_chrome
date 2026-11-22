// In-memory stand-in for the version routes (WEB-1504): invented versions and one invented comparison.
import type { TimeMachinePort, Version } from "./model";

export const FAKE_VERSIONS: readonly Version[] = [
  { kind: "checkpoint", revision: 3, savedMinute: "2026-11-20T09:15:00.000Z" },
  { kind: "submission", revision: 2, savedMinute: "2026-11-19T10:00:00.000Z" },
  { kind: "checkpoint", revision: 1, savedMinute: "2026-11-18T08:30:00.000Z" },
];

export function fakeTimeMachinePort(list: readonly Version[] = FAKE_VERSIONS): TimeMachinePort & { readonly compares: readonly [number, number][] } {
  const compares: [number, number][] = [];
  return {
    compares,
    async versions() { return { kind: "ready", versions: list }; },
    async compare(_id, from, to) {
      compares.push([from, to]);
      return {
        kind: "ready",
        blocks: [{ op: "changed", words: [
          { op: "same", text: "Izmišljeni" }, { op: "removed", text: "stari" }, { op: "added", text: "novi" }, { op: "same", text: "odlomak." },
        ] }],
      };
    },
    async version(_id, revision) {
      if (!list.some((v) => v.revision === revision)) return { kind: "notFound" };
      return { kind: "ready", revision, document: JSON.stringify({ schemaVersion: 2, nodes: [
        { type: "heading", children: [{ type: "text", text: "Uvod" }] },
        { type: "paragraph", children: [{ type: "text", text: `Izmišljeni odlomak verzije ${revision}.` }] },
      ] }) };
    },
  };
}
