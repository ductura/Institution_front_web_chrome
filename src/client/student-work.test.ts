// WEB-1402: "Započni rad" over an invented transport. Invented ids only.
import { describe, expect, it, vi } from "vitest";

import { startWorkCall, type StartWorkTransport } from "./api";
import { assignmentIdToSend, startWork, startWorkOnce } from "./student-work";

const ASSIGNMENT = "20000000-0000-4000-8000-000000000001";
const DOCUMENT = "30000000-0000-4000-8000-000000000001";
const WORK = { assignmentId: ASSIGNMENT, documentId: DOCUMENT, created: true, workLanguage: "hr", facultyRulesVersion: 3 };

const answer = (status: number, body: unknown): StartWorkTransport => async () => ({ ok: true, status, body });
const refuse = (status: number, code = "error"): StartWorkTransport => async () => ({ ok: false, status, code });

describe("startWork", () => {
  it("a 201 that names the same assignment is a started work", async () => {
    expect(await startWork(answer(201, WORK), ASSIGNMENT)).toEqual({ kind: "zapocet", work: WORK });
  });

  it("a later call answers 200 with the same work, not made again", async () => {
    const again = { ...WORK, created: false };
    expect(await startWork(answer(200, again), ASSIGNMENT)).toEqual({ kind: "zapocet", work: again });
  });

  it("sends the id in lowercase and nothing for a malformed id", async () => {
    const seen: string[] = [];
    const call: StartWorkTransport = async (id) => { seen.push(id); return { ok: true, status: 201, body: WORK }; };
    await startWork(call, ASSIGNMENT.toUpperCase());
    expect(await startWork(call, "nije-uuid")).toEqual({ kind: "nije-pronaden" });
    expect(seen).toEqual([ASSIGNMENT]);
    expect(assignmentIdToSend("../start")).toBeNull();
  });

  it.each([
    ["another assignment", { ...WORK, assignmentId: "20000000-0000-4000-8000-000000000002" }, 201],
    ["an unknown field", { ...WORK, studentId: DOCUMENT }, 201],
    ["a missing field", { assignmentId: ASSIGNMENT, documentId: DOCUMENT, created: true, workLanguage: "hr" }, 201],
    ["an unknown language", { ...WORK, workLanguage: "de" }, 201],
    ["a rules version of 0", { ...WORK, facultyRulesVersion: 0 }, 201],
    ["a fractional rules version", { ...WORK, facultyRulesVersion: 1.5 }, 201],
    ["created on a 200", WORK, 200],
    ["not created on a 201", { ...WORK, created: false }, 201],
    ["a 202", WORK, 202],
    ["no body", null, 201],
  ])("%s is unknown, never a started work", async (_name, body, status) => {
    expect(await startWork(answer(status, body), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });

  it("401 and 403 lead to the no-access screen in their kind", async () => {
    expect(await startWork(refuse(401), ASSIGNMENT)).toEqual({ kind: "bez-pristupa", access: "signedOut" });
    expect(await startWork(refuse(401, "session_idle_expired"), ASSIGNMENT)).toEqual({ kind: "bez-pristupa", access: "expired" });
    expect(await startWork(refuse(403), ASSIGNMENT)).toEqual({ kind: "bez-pristupa", access: "denied" });
  });

  it("404 is not found; 409 not_accepting asks for the notice first; any other 409 is unknown", async () => {
    expect(await startWork(refuse(404, "not_found"), ASSIGNMENT)).toEqual({ kind: "nije-pronaden" });
    expect(await startWork(refuse(409, "not_accepting"), ASSIGNMENT)).toEqual({ kind: "prvo-obavijest" });
    expect(await startWork(refuse(409, "conflict"), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });

  it("a broken connection, a server error and a throwing transport are unknown", async () => {
    expect(await startWork(refuse(0, "unexpected"), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await startWork(refuse(503), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await startWork(async () => { throw new Error("mreža"); }, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });
});

describe("startWorkOnce", () => {
  it("a double click sends one request and both clicks get the same work", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const call = vi.fn<StartWorkTransport>(async () => { await gate; return { ok: true, status: 201, body: WORK }; });
    const first = startWorkOnce(call, ASSIGNMENT);
    const second = startWorkOnce(call, ASSIGNMENT.toUpperCase());
    release();
    expect(await first).toEqual(await second);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("a click after the answer asks again (the server answers the same work)", async () => {
    const call = vi.fn<StartWorkTransport>(async () => ({ ok: true, status: 200, body: { ...WORK, created: false } }));
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
      return new Response(JSON.stringify(WORK), { status: 201, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    expect(await startWorkCall(transport)(ASSIGNMENT)).toEqual({ ok: true, status: 201, body: WORK });
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
