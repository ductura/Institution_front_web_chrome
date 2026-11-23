import { describe, expect, it } from "vitest";

import vectors from "../../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };
import { createApi } from "../../../../../../../src/client/api.ts";
import { readSubmissionHistory, readWithdrawalSetting, saveWithdrawalSetting, type HistoryCall } from "./contract";
import { historyPort } from "./port";

// PIL-D3-NASTAVNIK: the real port over createApi, answered by the contract's own vectors
// (migration-contract-vectors.generated.json), so the shapes are the server's, not local copies.
type Vector = {
  route: string; name: string;
  request: { params: Record<string, string>; body?: unknown };
  response: { status: number; contentType?: string; body?: unknown };
};
const all = vectors as unknown as Vector[];
const vector = (route: string, name: string): Vector => {
  const found = all.find((v) => v.route === route && v.name === name);
  if (found === undefined) throw new Error(`vector missing: ${route} ${name}`);
  return found;
};
const HISTORY = "teacher.submission-history.get";
const GET = "teacher.submission-withdrawal.get";
const POST = "teacher.submission-withdrawal.post";

function portAnswering(v: Vector) {
  const asked: { method: string; path: string; body: string | null }[] = [];
  let expired = 0;
  const fetchImpl: typeof fetch = async (url, init) => {
    asked.push({ method: init?.method ?? "GET", path: new URL(String(url)).pathname, body: (init?.body as string | undefined) ?? null });
    return new Response(v.response.body === undefined ? null : JSON.stringify(v.response.body), {
      status: v.response.status, headers: { "content-type": v.response.contentType ?? "application/json" },
    });
  };
  const call = historyPort(createApi({ baseUrl: "http://ductura.test", fetchImpl }) as unknown as HistoryCall, () => { expired += 1; });
  return { call, asked, expired: () => expired };
}

describe("submission history port over the contract (PIL-D3-NASTAVNIK)", () => {
  it("(1) reads every submission and withdrawal of one student with its record time", async () => {
    const v = vector(HISTORY, "history");
    const { assignmentId = "", studentId = "" } = v.request.params;
    const { call, asked, expired } = portAnswering(v);
    const read = await readSubmissionHistory(call, assignmentId, studentId);
    expect(asked).toEqual([{ method: "GET", path: `/api/v1/teacher/assignments/${assignmentId}/students/${studentId}/submission-history`, body: null }]);
    if (read.kind !== "ready") throw new Error(read.kind);
    const sent = (v.response.body as { events: { kind: string; at: string }[] }).events;
    expect(read.events.map((e) => [e.kind, e.at])).toEqual(sent.map((e) => [e.kind, e.at]));
    expect(expired()).toBe(0);
  });

  it("(3) a withdrawn submission stays in the history next to its withdrawal and the next submission", async () => {
    const v = vector(HISTORY, "history");
    const read = await readSubmissionHistory(portAnswering(v).call, v.request.params.assignmentId ?? "", v.request.params.studentId ?? "");
    if (read.kind !== "ready") throw new Error(read.kind);
    const withdrawal = read.events.find((e) => e.kind === "withdrawal");
    expect(withdrawal).toBeDefined();
    expect(read.events.some((e) => e.kind === "submission" && e.submissionId === withdrawal?.submissionId)).toBe(true);
  });

  it("an empty history is empty, not unavailable; 404 is not found; 503 is unavailable, never empty", async () => {
    const read = async (name: string) => {
      const v = vector(HISTORY, name);
      return readSubmissionHistory(portAnswering(v).call, v.request.params.assignmentId ?? "", v.request.params.studentId ?? "");
    };
    expect(await read("empty")).toEqual({ kind: "ready", events: [] });
    expect(await read("not-found")).toEqual({ kind: "greska", code: "not_found" });
    expect(await read("unavailable")).toEqual({ kind: "nepoznato" });
  });

  it("(2) the switch reads what the server holds", async () => {
    for (const [name, enabled] of [["default", true], ["switched-off", false]] as const) {
      const v = vector(GET, name);
      const { call, asked } = portAnswering(v);
      expect(await readWithdrawalSetting(call, v.request.params.assignmentId ?? "")).toEqual({ kind: "ready", enabled });
      expect(asked).toEqual([{ method: "GET", path: `/api/v1/teacher/assignments/${v.request.params.assignmentId}/submission-withdrawal`, body: null }]);
    }
    for (const name of ["not-found", "unavailable"]) {
      const v = vector(GET, name);
      expect(await readWithdrawalSetting(portAnswering(v).call, v.request.params.assignmentId ?? "")).toEqual({ kind: "nepoznato" });
    }
  });

  it("(2) the switch is saved on the server with one POST and shown saved only from the server's answer", async () => {
    for (const [name, enabled] of [["switch-off", false], ["switch-on", true]] as const) {
      const v = vector(POST, name);
      const { call, asked } = portAnswering(v);
      expect(await saveWithdrawalSetting(call, v.request.params.assignmentId ?? "", enabled)).toEqual({ kind: "spremljeno", enabled });
      expect(asked).toEqual([{ method: "POST", path: `/api/v1/teacher/assignments/${v.request.params.assignmentId}/submission-withdrawal`, body: JSON.stringify({ allowed: enabled }) }]);
    }
    // The server answering a value other than the one asked for is never shown as saved.
    const off = vector(POST, "switch-off");
    expect(await saveWithdrawalSetting(portAnswering(off).call, off.request.params.assignmentId ?? "", true)).toEqual({ kind: "nepoznato" });
  });

  it("a refused or missing save says so and changes nothing on screen", async () => {
    const save = async (name: string) => {
      const v = vector(POST, name);
      return saveWithdrawalSetting(portAnswering(v).call, v.request.params.assignmentId ?? "", false);
    };
    expect(await save("origin-mismatch")).toEqual({ kind: "greska", code: "forbidden" });
    expect(await save("not-found")).toEqual({ kind: "greska", code: "not_found" });
    expect(await save("unavailable")).toEqual({ kind: "nepoznato" });
  });

  it("an ended session calls onExpired once per answer that found it, on each of the three operations", async () => {
    const history = portAnswering(vector(HISTORY, "unauthorized"));
    const a = vector(HISTORY, "unauthorized").request.params;
    expect(await readSubmissionHistory(history.call, a.assignmentId ?? "", a.studentId ?? "")).toEqual({ kind: "session-expired" });
    expect(history.expired()).toBe(1);

    const get = portAnswering(vector(GET, "unauthorized"));
    expect(await readWithdrawalSetting(get.call, a.assignmentId ?? "")).toEqual({ kind: "session-expired" });
    expect(get.expired()).toBe(1);

    const post = portAnswering(vector(POST, "unauthorized"));
    expect(await saveWithdrawalSetting(post.call, a.assignmentId ?? "", true)).toEqual({ kind: "session-expired" });
    expect(post.expired()).toBe(1);
  });
});
