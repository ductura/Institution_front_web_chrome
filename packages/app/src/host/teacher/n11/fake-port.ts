// In-memory stand-in for the N-11 reads (WEB-2160); invented text and times only.
import type { N11Block, N11Compare, N11Port, N11Version, N11Versions } from "./model";

export const FAKE_VERSIONS: readonly N11Version[] = [
  { kind: "submission", revision: 2, savedMinute: "2026-11-05T20:14Z" },
  { kind: "checkpoint", revision: 5, savedMinute: "2026-11-01T09:00Z" },
  { kind: "submission", revision: 1, savedMinute: "2026-10-28T09:50Z" },
];

export const FAKE_BLOCKS: readonly N11Block[] = [
  { kind: "heading", level: 1, change: "unchanged", text: "Lokalni mediji" },
  { kind: "paragraph", change: "removed", text: "Stari uvodni odlomak." },
  { kind: "paragraph", change: "added", text: "Novi uvodni odlomak s dvije rečenice." },
  { kind: "paragraph", change: "unchanged", text: "Nepromijenjen odlomak." },
];

export function fakeN11Port(
  versions: N11Versions = { kind: "ready", versions: FAKE_VERSIONS },
  compare: N11Compare = { kind: "ready", blocks: FAKE_BLOCKS },
): N11Port {
  return { versions: async () => versions, compare: async () => compare };
}
