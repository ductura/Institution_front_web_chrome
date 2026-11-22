// An in-memory server for "Podrijetlo teksta" (WEB-0911), invented data. Tests and the catalogue only.
import type { OriginCall, OriginComposition } from "./contract";

export const DOCUMENT = "demo-rad";

export const FAKE_COMPOSITION: OriginComposition = {
  totalCodePoints: 1000,
  rhythmRecorded: true,
  shares: [
    { kind: "typed", codePoints: 620, percent: 62 },
    { kind: "assistant_inserted", codePoints: 100, percent: 10 },
    { kind: "assistant_match", codePoints: 40, percent: 4 },
    { kind: "imported_file", codePoints: 120, percent: 12 },
    { kind: "pasted_known", codePoints: 90, percent: 9 },
    { kind: "pasted_unknown", codePoints: 30, percent: 3 },
  ],
  segments: [
    { id: "s1", text: "Izmišljeni uvodni odlomak.", kind: "typed", at: "2026-11-18T09:00:00.000Z", gapsMs: [180, 220, 140] },
    { id: "s2", text: "Izmišljeni zalijepljeni odlomak.", kind: "pasted_unknown", at: "2026-11-18T09:20:00.000Z" },
  ],
};

export function fakeOriginServer(opts: { composition?: unknown; status?: number; throws?: boolean } = {}) {
  const calls: { id: string; params?: unknown }[] = [];
  const call: OriginCall = async (id, input) => {
    calls.push({ id, params: input.params });
    if (opts.throws === true) throw new Error("offline");
    if (opts.status !== undefined && opts.status !== 200) return { ok: false as const, status: opts.status, code: "error" };
    return { ok: true as const, status: 200, body: opts.composition ?? FAKE_COMPOSITION };
  };
  return { call, calls };
}
