import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { proofRequestsHr as t } from "./messages.hr";
import { ProofRequestsView } from "./ProofRequests";
import { dayOf, openRows, readRequests, type ProofRequest } from "./proof-requests";

const A = "0f0e0d0c-0b0a-4908-8706-050403020115";
const S1 = "11111111-2222-4333-8444-555566667777";
const S2 = "22222222-3333-4444-8555-666677778888";
const NOW = Date.parse("2026-11-25T12:00:00.000Z");

const req = (id: string, sourceId: string, dueAt: string, closedAt: string | null = null): ProofRequest =>
  ({ id, sourceId, instruction: ` Izmišljena uputa ${id} `, dueAt, closedAt });

describe("ED-15 zatražene potvrde: reading", () => {
  it("reads student.source-proof-requests.get through the client and keeps only what the student may see", async () => {
    const calls: unknown[] = [];
    const call = (async (id: string, input: unknown) => {
      calls.push([id, input]);
      return { ok: true, status: 200, body: { proofRequests: [{ ...req("r1", S1, "2026-11-28T10:00:00.000Z"), createdAt: "2026-11-20T10:00:00.000Z", extra: "x" }] } };
    }) as never;
    expect(await readRequests(call, A)).toEqual({ kind: "ready", requests: [req("r1", S1, "2026-11-28T10:00:00.000Z")] });
    expect(calls).toEqual([["student.source-proof-requests.get", { params: { assignmentId: A }, query: undefined, body: undefined }]]);
  });

  it("an error, a thrown call or a reply off the contract is unavailable", async () => {
    expect(await readRequests((async () => ({ ok: false, status: 503 })) as never, A)).toEqual({ kind: "unavailable" });
    expect(await readRequests((async () => { throw new Error("mreža"); }) as never, A)).toEqual({ kind: "unavailable" });
    expect(await readRequests((async () => ({ ok: true, status: 200, body: { proofRequests: [{ id: 1 }] } })) as never, A)).toEqual({ kind: "unavailable" });
    expect(await readRequests((async () => ({ ok: true, status: 200, body: {} })) as never, A)).toEqual({ kind: "unavailable" });
  });
});

describe("ED-15 zatražene potvrde: rows", () => {
  it("lists open requests only, earliest deadline first, named by the work's source", () => {
    const rows = openRows([
      req("r1", S1, "2026-12-01T10:00:00.000Z"),
      req("r2", S2, "2026-11-28T10:00:00.000Z", "2026-11-21T10:00:00.000Z"),
      req("r3", S2, "2026-11-20T10:00:00.000Z"),
    ], [{ id: S1, label: "Izmišljena (2021)" }], NOW);
    expect(rows.map((r) => [r.id, r.label, r.instruction, r.overdue])).toEqual([
      ["r3", null, "Izmišljena uputa r3", true],
      ["r1", "Izmišljena (2021)", "Izmišljena uputa r1", false],
    ]);
  });

  it("writes the day the Croatian way and nothing for a broken date", () => {
    expect(dayOf("2026-11-28T10:00:00.000Z")).toBe("28. 11. 2026.");
    expect(dayOf("nije datum")).toBe("");
  });

  it("counts open requests in Croatian", () => {
    expect([1, 2, 5, 11, 21, 22].map(t.titleOpen)).toEqual([
      "Zatražene potvrde (1 otvorena)", "Zatražene potvrde (2 otvorene)", "Zatražene potvrde (5 otvorenih)",
      "Zatražene potvrde (11 otvorenih)", "Zatražene potvrde (21 otvorena)", "Zatražene potvrde (22 otvorene)",
    ]);
  });
});

describe("ED-15 zatražene potvrde: the block", () => {
  const out = (read: Parameters<typeof ProofRequestsView>[0]["read"]) =>
    renderToStaticMarkup(createElement(ProofRequestsView, { read, sources: [{ id: S1, label: "Izmišljena (2021)" }], now: NOW, onRetry: () => undefined }));

  it("has a loading, an error, an empty and an all-attached state", () => {
    expect(out({ kind: "loading" })).toContain(t.loading);
    const error = out({ kind: "unavailable" });
    expect(error).toContain(t.error);
    expect(error).toContain(t.retry);
    expect(out({ kind: "ready", requests: [] })).toContain(t.none);
    expect(out({ kind: "ready", requests: [req("r1", S1, "2026-12-01T10:00:00.000Z", "2026-11-21T10:00:00.000Z")] })).toContain(t.allDone);
  });

  it("opens itself while something waits and says what to attach and by when", () => {
    const html = out({ kind: "ready", requests: [req("r1", S1, "2026-12-01T10:00:00.000Z"), req("r2", S1, "2026-11-01T10:00:00.000Z", "2026-11-02T10:00:00.000Z")] });
    expect(html).toContain("<details open=\"\"");
    expect(html).toContain(t.titleOpen(1));
    expect(html).toContain(t.open(1, 2));
    expect(html).toContain(t.item("Izmišljena (2021)"));
    expect(html).toContain(t.due("1. 12. 2026."));
    expect(html).toContain(t.only);
  });
});
