// An in-memory server for "Pragovi po vrsti podrijetla" (PIL-P1-PRAGOVI-ADMIN), invented data. Tests only.
import type { OriginThreshold, ThresholdCall } from "./contract";

/** The demo values the spec allows (P-1 rule 12): unknown paste 15 % soft, assistant 10 % hard. */
export const DEMO_THRESHOLDS: readonly OriginThreshold[] = [
  { origin: "pasted_unknown", thresholdPercent: 15, strictness: "soft" },
  { origin: "assistant_inserted", thresholdPercent: 10, strictness: "hard" },
];

type Options = { thresholds?: readonly OriginThreshold[]; status?: number; body?: unknown; throws?: boolean };

/** Holds the thresholds like the server: a put replaces the kind's row, a delete removes it. */
export function fakeThresholdServer(opts: Options = {}) {
  let rows: OriginThreshold[] = [...(opts.thresholds ?? [])];
  const calls: { id: string; params?: unknown; body?: unknown }[] = [];
  const call: ThresholdCall = async (id, input) => {
    calls.push({ id, params: input.params, body: input.body });
    if (opts.throws === true) throw new Error("offline");
    if (opts.status !== undefined) return { ok: false as const, status: opts.status, code: "error" };
    const origin = input.params?.origin;
    if (id === "institution.origin-thresholds.get") return { ok: true as const, status: 200, body: opts.body ?? { thresholds: rows } };
    if (id === "institution.origin-threshold.delete") {
      rows = rows.filter((row) => row.origin !== origin);
      return { ok: true as const, status: 204 };
    }
    const body = input.body as Omit<OriginThreshold, "origin">;
    rows = [...rows.filter((row) => row.origin !== origin), { origin: origin as OriginThreshold["origin"], ...body }];
    return { ok: true as const, status: 200, body: { changed: true } };
  };
  return { call, calls, rows: () => rows };
}
