import { describe, expect, it } from "vitest";

import { createApi } from "../../../../../../src/client/api";
import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { PAGES, resolve } from "../../../routes";
import { deleteThreshold, parsePercent, putThreshold, readThresholds, type ThresholdCall } from "./contract";
import { DEMO_THRESHOLDS, fakeThresholdServer } from "./fake-port";
import { thresholdMessages as t } from "./messages.hr";
import { checkDraft, say } from "./OriginThresholdsPage";

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
    expect(await bad({ thresholds: [{ ...row, thresholdPercent: 1.5 }] })).toBe("unavailable");
    expect(await bad({ thresholds: [{ ...row, strictness: "medium" }] })).toBe("unavailable");
    expect(await bad({ thresholds: [{ ...row, origin: "keystrokes" }] })).toBe("unavailable");
    expect(await bad({ thresholds: [{ ...row, score: 3 }] })).toBe("unavailable");
    expect(await bad({ thresholds: [row, row] })).toBe("unavailable");
    expect(await bad({ thresholds: [], extra: true })).toBe("unavailable");
  });

  it("names every refusal of a read: 401, 403 (not the administrator), anything else is unavailable", async () => {
    expect((await readThresholds(fakeThresholdServer({ status: 401 }).call)).kind).toBe("signedOut");
    expect((await readThresholds(fakeThresholdServer({ status: 403 }).call)).kind).toBe("denied");
    expect((await readThresholds(fakeThresholdServer({ status: 422 }).call)).kind).toBe("unavailable");
    expect((await readThresholds(fakeThresholdServer({ status: 503 }).call)).kind).toBe("unavailable");
    expect((await readThresholds(fakeThresholdServer({ throws: true }).call)).kind).toBe("unavailable");
    for (const kind of ["signedOut", "denied", "invalid", "notSent", "unavailable", "unconfirmed"] as const) expect(say(kind)).toBe(t.errors[kind]);
  });

  it("a write is refused only on the server's own refusal; anything it cannot confirm is unconfirmed", async () => {
    const put = async (opts: Parameters<typeof fakeThresholdServer>[0]) => (await putThreshold(fakeThresholdServer(opts).call, "typed", "20", "soft")).kind;
    const del = async (opts: Parameters<typeof fakeThresholdServer>[0]) => (await deleteThreshold(fakeThresholdServer(opts).call, "typed")).kind;
    for (const write of [put, del]) {
      expect(await write({ status: 401 })).toBe("signedOut");
      expect(await write({ status: 403 })).toBe("denied");
      expect(await write({ status: 422 })).toBe("invalid");
      expect(await write({ status: 0, code: "client_rejected" })).toBe("notSent");
      // The server may have written the change: a 5xx, an unreadable success (ok:false with 200 or status 0), a dropped connection.
      expect(await write({ status: 503 })).toBe("unconfirmed");
      expect(await write({ status: 200, code: "unexpected" })).toBe("unconfirmed");
      expect(await write({ status: 0, code: "unexpected" })).toBe("unconfirmed");
      expect(await write({ throws: true })).toBe("unconfirmed");
    }
    for (const kind of ["unavailable", "unconfirmed"] as const) expect(t.errors[kind]).not.toMatch(/nije promijenjeno/);
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
  it("is a page of the administrator only; other roles go to their own home", () => {
    const page = PAGES.find((p) => p.path === "/ustanova/pragovi");
    expect(resolve("/ustanova/pragovi", "admin")).toEqual({ kind: "page", page });
    expect(page?.label).toBe(t.title);
    expect(resolve("/ustanova/pragovi", "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
    expect(resolve("/ustanova/pragovi", "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    expect(resolve("/ustanova/pragovi", null)).toEqual({ kind: "redirect", to: "/" });
  });

  it("holds no forbidden term in its text", () => {
    const texts = [t.title, t.lead, t.notice, t.current, t.none, t.shown(15, "soft"), t.percent, t.percentHint, t.percentInvalid,
      t.strictnessLabel, t.strictnessPick, t.strictnessMissing, t.strictnessHint, t.save, t.remove, t.saved, t.removed,
      t.retry, t.reload, ...Object.values(t.strictness), ...Object.values(t.kinds), ...Object.values(t.errors)];
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
