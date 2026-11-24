// WEB-1402: "Započni rad" over an invented transport. Invented ids only.
import { describe, expect, it, vi } from "vitest";

import { startWorkCall, type StartWorkTransport } from "./api";
import { assignmentIdToSend, startWork, startWorkOnce } from "./student-work";

const ASSIGNMENT = "20000000-0000-4000-8000-000000000001";
// The body of student-work.start.post (migration-contracts.generated.json): always 200.
const BODY = { workId: "30000000-0000-4000-8000-000000000001", rulesVersion: 3, language: "hr" };
const WORK = { assignmentId: ASSIGNMENT, ...BODY };

const answer = (status: number, body: unknown): StartWorkTransport => async () => ({ ok: true, status, body });
const refuse = (status: number, code = "error"): StartWorkTransport => async () => ({ ok: false, status, code });

describe("startWork", () => {
  it("a 200 in the shape of the contract is a started work of the assignment that was asked for", async () => {
    expect(await startWork(answer(200, BODY), ASSIGNMENT)).toEqual({ kind: "zapocet", work: WORK });
  });

  it("a work without faculty rules yet keeps rulesVersion null", async () => {
    const body = { ...BODY, rulesVersion: null };
    expect(await startWork(answer(200, body), ASSIGNMENT)).toEqual({ kind: "zapocet", work: { ...WORK, rulesVersion: null } });
  });

  it("sends the id in lowercase and nothing for a malformed id", async () => {
    const seen: string[] = [];
    const call: StartWorkTransport = async (id) => { seen.push(id); return { ok: true, status: 200, body: BODY }; };
    await startWork(call, ASSIGNMENT.toUpperCase());
    expect(await startWork(call, "nije-uuid")).toEqual({ kind: "nije-pronaden" });
    expect(seen).toEqual([ASSIGNMENT]);
    expect(assignmentIdToSend("../start")).toBeNull();
  });

  it.each([
    ["an unknown field", { ...BODY, studentId: ASSIGNMENT }, 200],
    ["a missing field", { workId: BODY.workId, language: "hr" }, 200],
    ["an empty work id", { ...BODY, workId: "" }, 200],
    ["a work id over 256 characters", { ...BODY, workId: "a".repeat(257) }, 200],
    ["an unknown language", { ...BODY, language: "de" }, 200],
    ["a rules version of 0", { ...BODY, rulesVersion: 0 }, 200],
    ["a fractional rules version", { ...BODY, rulesVersion: 1.5 }, 200],
    ["the old local shape", { assignmentId: ASSIGNMENT, documentId: BODY.workId, created: true, workLanguage: "hr", facultyRulesVersion: 3 }, 200],
    ["a 201", BODY, 201],
    ["no body", null, 200],
  ])("%s is unknown, never a started work", async (_name, body, status) => {
    expect(await startWork(answer(status, body), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });

  it("401 and 403 lead to the no-access screen in their kind", async () => {
    expect(await startWork(refuse(401, "unauthorized"), ASSIGNMENT)).toEqual({ kind: "bez-pristupa", access: "signedOut" });
    expect(await startWork(refuse(401, "session_idle_expired"), ASSIGNMENT)).toEqual({ kind: "bez-pristupa", access: "expired" });
    expect(await startWork(refuse(403), ASSIGNMENT)).toEqual({ kind: "bez-pristupa", access: "denied" });
  });

  it("404 is not found; 409 conflict (notice not acknowledged, or not open yet) leads to the assignment first", async () => {
    expect(await startWork(refuse(404, "not_found"), ASSIGNMENT)).toEqual({ kind: "nije-pronaden" });
    expect(await startWork(refuse(409, "conflict"), ASSIGNMENT)).toEqual({ kind: "prvo-obavijest" });
    expect(await startWork(refuse(409, "something_else"), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });

  it("a broken connection, a server error and a throwing transport are unknown", async () => {
    expect(await startWork(refuse(0, "unexpected"), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await startWork(refuse(503, "unavailable"), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await startWork(async () => { throw new Error("mreža"); }, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });
});

describe("startWorkOnce", () => {
  it("a double click sends one request and both clicks get the same work", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const call = vi.fn<StartWorkTransport>(async () => { await gate; return { ok: true, status: 200, body: BODY }; });
    const first = startWorkOnce(call, ASSIGNMENT);
    const second = startWorkOnce(call, ASSIGNMENT.toUpperCase());
    release();
    expect(await first).toEqual(await second);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("a click after the answer asks again (the server answers the same work)", async () => {
    const call = vi.fn<StartWorkTransport>(async () => ({ ok: true, status: 200, body: BODY }));
    await startWorkOnce(call, ASSIGNMENT);
    await startWorkOnce(call, ASSIGNMENT);
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe("startWorkCall", () => {
  const origin = { location: { origin: "https://ductura.test" } };

  it("posts an empty JSON body to the encoded path, same origin, no redirect", async () => {
    vi.stubGlobal("location", origin.location);
    const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
    const transport = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), init });
      return new Response(JSON.stringify(BODY), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    expect(await startWorkCall(transport)(ASSIGNMENT)).toEqual({ ok: true, status: 200, body: BODY });
    expect(seen[0]?.url).toBe(`https://ductura.test/api/v1/assignments/${ASSIGNMENT}/start`);
    expect(seen[0]?.init).toMatchObject({ method: "POST", redirect: "manual", credentials: "same-origin", body: "{}" });
    await startWorkCall(transport)("a/b");
    expect(seen[1]?.url).toBe("https://ductura.test/api/v1/assignments/a%2Fb/start");
    vi.unstubAllGlobals();
  });

  it("a refusal keeps its status and the code of its body; a non-JSON success is a failure", async () => {
    vi.stubGlobal("location", origin.location);
    const refused = (async () => new Response(JSON.stringify({ code: "session_idle_expired" }), { status: 401 })) as typeof fetch;
    expect(await startWorkCall(refused)(ASSIGNMENT)).toEqual({ ok: false, status: 401, code: "session_idle_expired" });
    const bare = (async () => new Response("nije json", { status: 404 })) as typeof fetch;
    expect(await startWorkCall(bare)(ASSIGNMENT)).toEqual({ ok: false, status: 404, code: "error" });
    const html = (async () => new Response("<p>", { status: 200, headers: { "content-type": "text/html" } })) as typeof fetch;
    expect(await startWorkCall(html)(ASSIGNMENT)).toEqual({ ok: false, status: 0, code: "unexpected" });
    const broken = (async () => { throw new TypeError("mreža"); }) as typeof fetch;
    expect(await startWorkCall(broken)(ASSIGNMENT)).toEqual({ ok: false, status: 0, code: "unexpected" });
    vi.unstubAllGlobals();
  });
});
