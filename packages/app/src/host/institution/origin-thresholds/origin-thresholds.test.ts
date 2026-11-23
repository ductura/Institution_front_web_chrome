import { describe, expect, it } from "vitest";

import { createApi } from "../../../../../../src/client/api";
import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { PAGES, resolve, type Page } from "../../../routes";
import { deleteThreshold, parsePercent, putThreshold, readThresholds, type ThresholdCall } from "./contract";
import { DEMO_THRESHOLDS, fakeThresholdServer } from "./fake-port";
import { thresholdMessages as t } from "./messages.hr";
import { checkDraft } from "./OriginThresholdsPage";

describe("PIL-P1-PRAGOVI-ADMIN port", () => {
  it("reads the thresholds with one request, in the order of the kinds; none written means none shown", async () => {
    const { call, calls } = fakeThresholdServer({ thresholds: DEMO_THRESHOLDS });
    expect(await readThresholds(call)).toEqual({ kind: "ready", thresholds: [DEMO_THRESHOLDS[1], DEMO_THRESHOLDS[0]] });
    expect(calls).toEqual([{ id: "institution.origin-thresholds.get", params: undefined, body: undefined }]);
    expect(await readThresholds(fakeThresholdServer().call)).toEqual({ kind: "ready", thresholds: [] });
  });

  it("refuses an answer outside the contract as a whole", async () => {
    const bad = async (body: unknown) => (await readThresholds(fakeThresholdServer({ body }).call)).kind;
    const row = DEMO_THRESHOLDS[0];
    expect(await bad({ thresholds: [{ ...row, thresholdPercent: 101 }] })).toBe("unavailable");
    expect(await bad({ thresholds: [{ ...row, thresholdPercent: -1 }] })).toBe("unavailable");
    expect(await bad({ thresholds: [{ ...row, thresholdPercent: "15" }] })).toBe("unavailable");
    expect(await bad({ thresholds: [{ ...row, strictness: "medium" }] })).toBe("unavailable");
    expect(await bad({ thresholds: [{ ...row, origin: "keystrokes" }] })).toBe("unavailable");
    expect(await bad({ thresholds: [{ ...row, score: 3 }] })).toBe("unavailable");
    expect(await bad({ thresholds: [row, row] })).toBe("unavailable");
    expect(await bad({ thresholds: [], extra: true })).toBe("unavailable");
    // The extract's GET answer says "number": a stored value that is not whole is still read, not the page refused.
    const half = { ...row, thresholdPercent: 12.5 };
    expect(await readThresholds(fakeThresholdServer({ body: { thresholds: [half] } }).call)).toEqual({ kind: "ready", thresholds: [half] });
    expect(t.shown(12.5, "soft")).toBe("12,5 % · Blagi");
  });

  it("names every refusal of a read: 401, 403 (not the administrator), 503 and a dropped connection", async () => {
    expect((await readThresholds(fakeThresholdServer({ status: 401 }).call)).kind).toBe("signedOut");
    expect((await readThresholds(fakeThresholdServer({ status: 403 }).call)).kind).toBe("denied");
    expect((await readThresholds(fakeThresholdServer({ status: 503 }).call)).kind).toBe("unavailable");
    expect((await readThresholds(fakeThresholdServer({ throws: true }).call)).kind).toBe("unavailable");
  });

  it("claims a write neither done nor undone unless the server said so", async () => {
    const answer = (result: Awaited<ReturnType<ThresholdCall>>): ThresholdCall => async () => result;
    const both = async (call: ThresholdCall) => [(await putThreshold(call, "typed", "20", "soft")).kind, (await deleteThreshold(call, "typed")).kind];
    // The server's own refusals: nothing was written.
    expect(await both(fakeThresholdServer({ status: 401 }).call)).toEqual(["signedOut", "signedOut"]);
    expect(await both(fakeThresholdServer({ status: 403 }).call)).toEqual(["denied", "denied"]);
    expect(await both(fakeThresholdServer({ status: 422 }).call)).toEqual(["invalid", "invalid"]);
    // Refused by the client before sending: the server never saw it.
    expect(await both(answer({ ok: false, status: 0, code: "client_rejected" }))).toEqual(["notSent", "notSent"]);
    // Anything else may or may not have been written: 5xx, 409, a dropped connection, an unreadable or unexpected success.
    for (const call of [
      fakeThresholdServer({ status: 503 }).call, fakeThresholdServer({ status: 409 }).call, fakeThresholdServer({ throws: true }).call,
      answer({ ok: false, status: 0, code: "unexpected" }), answer({ ok: false, status: 200, code: "unexpected" }),
      answer({ ok: true, status: 202 }),
    ]) expect(await both(call)).toEqual(["unconfirmed", "unconfirmed"]);
  });

  it("sends a valid threshold with the contract's body", async () => {
    const server = fakeThresholdServer();
    expect(await putThreshold(server.call, "pasted_unknown", " 15 ", "soft")).toEqual({ kind: "saved" });
    expect(server.calls).toEqual([{ id: "institution.origin-threshold.put", params: { origin: "pasted_unknown" }, body: { thresholdPercent: 15, strictness: "soft" } }]);
    expect(server.rows()).toEqual([DEMO_THRESHOLDS[0]]);
  });

  it("never sends an invalid percent or strictness", async () => {
    for (const typed of ["", "abc", "-1", "101", "1.5", "1e2", "15%", "+5", "0x10", "1000"]) {
      const server = fakeThresholdServer();
      expect(await putThreshold(server.call, "typed", typed, "hard")).toEqual({ kind: "notSent" });
      expect(server.calls).toEqual([]);
      expect(parsePercent(typed)).toBeNull();
      expect(checkDraft({ percent: typed, strictness: "hard" })).toEqual({ percent: t.percentInvalid });
    }
    const server = fakeThresholdServer();
    expect(await putThreshold(server.call, "typed", "10", "")).toEqual({ kind: "notSent" });
    expect(server.calls).toEqual([]);
    expect(checkDraft({ percent: "0", strictness: "" })).toEqual({ strictness: t.strictnessMissing });
    expect(checkDraft({ percent: "100", strictness: "soft" })).toEqual({});
  });

  it("removing a threshold leaves the kind without one", async () => {
    const server = fakeThresholdServer({ thresholds: DEMO_THRESHOLDS });
    expect(await deleteThreshold(server.call, "pasted_unknown")).toEqual({ kind: "saved" });
    expect(server.calls.at(-1)).toEqual({ id: "institution.origin-threshold.delete", params: { origin: "pasted_unknown" }, body: undefined });
    const read = await readThresholds(server.call);
    expect(read.kind === "ready" && read.thresholds.some((row) => row.origin === "pasted_unknown")).toBe(false);
  });
});

describe("PIL-P1-PRAGOVI-ADMIN route and text", () => {
  const page = PAGES.find((p) => p.path === "/ustanova/pragovi") as Page;

  it("is a page of the administrator only; other roles go to their own home", () => {
    expect(resolve("/ustanova/pragovi", "admin")).toEqual({ kind: "page", page });
    expect(page.label).toBe(t.title);
    expect(resolve("/ustanova/pragovi", "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
    expect(resolve("/ustanova/pragovi", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/ustanova/pragovi", null)).toEqual({ kind: "redirect", to: "/" });
  });

  it("holds no forbidden term in its text", () => {
    const texts = [t.title, t.lead, t.notice, t.current, t.none, t.shown(15, "soft"), t.percent, t.percentHint, t.percentInvalid,
      t.strictnessLabel, t.strictnessPick, t.strictnessMissing, t.strictnessHint, t.save, t.remove, t.saved, t.removed,
      t.retry, t.reload, t.stale, t.denied, t.saveFor("x"), t.removeFor("x"), t.reloadFor("x"),
      ...Object.values(t.strictness), ...Object.values(t.kinds), ...Object.values(t.readErrors), ...Object.values(t.writeErrors)];
    for (const text of texts) expect({ text, terms: findForbiddenTerms(text) }).toEqual({ text, terms: [] });
  });
});

describe("PIL-P1-PRAGOVI-ADMIN over the real client (createApi, contract extract)", () => {
  it("sends the contract's paths, methods and body, and reads the answers", async () => {
    const sent: { method: string; url: string; body: string | null }[] = [];
    const replies = [
      new Response(JSON.stringify({ thresholds: DEMO_THRESHOLDS }), { status: 200, headers: { "content-type": "application/json" } }),
      new Response(JSON.stringify({ changed: true }), { status: 200, headers: { "content-type": "application/json" } }),
      new Response(null, { status: 204 }),
    ];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      sent.push({ method: request.method, url: request.url, body: request.method === "GET" || request.method === "DELETE" ? null : await request.text() });
      return replies.shift()!;
    }) as typeof fetch;
    const call = createApi({ baseUrl: "https://izmisljeni.example", fetchImpl }) as unknown as ThresholdCall;
    expect((await readThresholds(call)).kind).toBe("ready");
    expect(await putThreshold(call, "assistant_match", "8", "hard")).toEqual({ kind: "saved" });
    expect(await deleteThreshold(call, "assistant_match")).toEqual({ kind: "saved" });
    expect(sent.map(({ method, url }) => `${method} ${new URL(url).pathname}`)).toEqual([
      "GET /api/v1/institution/origin-thresholds",
      "PUT /api/v1/institution/origin-thresholds/assistant_match",
      "DELETE /api/v1/institution/origin-thresholds/assistant_match",
    ]);
    expect(JSON.parse(sent[1]!.body!)).toEqual({ thresholdPercent: 8, strictness: "hard" });
  });
});
