import { describe, expect, it } from "vitest";

import { keyDatesPort, readKeyDates, type KeyDatesCall } from "./contract";

const MENTORSHIP = "00000000-0000-4000-8000-0000000000aa";
const ok = (body: unknown, status = 200): KeyDatesCall => async () => ({ ok: true, status, body });
const fail = (status: number, code: string): KeyDatesCall => async () => ({ ok: false, status, code });

// A probe answer in the shape of the contract's 200 (invented dates only).
const ANSWER = { dates: [
  { kind: "deadline", id: "00000000-0000-4000-8000-000000000001", at: "2026-12-14T22:59:00.000Z" },
  { kind: "milestone", id: "00000000-0000-4000-8000-000000000002", at: "2026-11-30T09:00:00.000Z", title: "Izmišljena etapa" },
  { kind: "consultation", id: "00000000-0000-4000-8000-000000000003", at: "2026-12-01T13:00:00.000Z", state: "countered" },
] };

describe("mentorship.key-dates.get port", () => {
  it("asks the contract route for the one mentorship and keeps the dates as given", async () => {
    const asked: unknown[] = [];
    const call: KeyDatesCall = async (id, input) => { asked.push([id, input]); return { ok: true, status: 200, body: ANSWER }; };
    expect(await readKeyDates(call, MENTORSHIP)).toEqual({ kind: "ready", dates: ANSWER.dates });
    expect(asked).toEqual([["mentorship.key-dates.get", { params: { id: MENTORSHIP }, query: undefined, body: undefined }]]);
  });

  it("an empty list stays empty only when the server says so", async () => {
    expect(await readKeyDates(ok({ dates: [] }), MENTORSHIP)).toEqual({ kind: "ready", dates: [] });
  });

  it("401 is signed out; 404, 503, a rejected call and a broken connection are unavailable, not an empty list", async () => {
    expect(await readKeyDates(fail(401, "unauthorized"), MENTORSHIP)).toEqual({ kind: "signedOut" });
    expect(await readKeyDates(fail(404, "not_found"), MENTORSHIP)).toEqual({ kind: "unavailable" });
    expect(await readKeyDates(fail(503, "unavailable"), MENTORSHIP)).toEqual({ kind: "unavailable" });
    expect(await readKeyDates(fail(0, "client_rejected"), MENTORSHIP)).toEqual({ kind: "unavailable" });
    expect(await readKeyDates(async () => { throw new TypeError("offline"); }, MENTORSHIP)).toEqual({ kind: "unavailable" });
  });

  it("an answer outside the contract is unavailable: unknown kind, extra field, other status", async () => {
    expect(await readKeyDates(ok({ dates: [{ kind: "opens", id: ANSWER.dates[0]!.id, at: ANSWER.dates[0]!.at }] }), MENTORSHIP)).toEqual({ kind: "unavailable" });
    expect(await readKeyDates(ok({ dates: [{ ...ANSWER.dates[0], daysLeft: 3 }] }), MENTORSHIP)).toEqual({ kind: "unavailable" });
    expect(await readKeyDates(ok({}), MENTORSHIP)).toEqual({ kind: "unavailable" });
    expect(await readKeyDates(ok(ANSWER, 204), MENTORSHIP)).toEqual({ kind: "unavailable" });
  });

  it("the port reads through the call it is given", async () => {
    expect(await keyDatesPort(() => ok(ANSWER)).read(MENTORSHIP)).toEqual({ kind: "ready", dates: ANSWER.dates });
  });
});
