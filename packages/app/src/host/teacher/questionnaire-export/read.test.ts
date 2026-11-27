import { describe, expect, it, vi } from "vitest";

import { readExport, readTitle } from "./read";

const ID = "11111111-1111-4111-8111-111111111111";
const BODY = { schema: "questionnaire-export-v1", questionnaireId: ID, variables: [], rows: [], responseCount: 0, includesText: false };
const apiOf = (answer: unknown) => vi.fn(async () => answer) as never;
const ok = (body: unknown) => ({ ok: true, status: 200, body });
const fail = (status: number, code: string) => ({ ok: false, status, code });

describe("readExport", () => {
  it("asks for free text only when told to", async () => {
    const call = vi.fn(async () => ok(BODY));
    await readExport(call as never, ID, false);
    await readExport(call as never, ID, true);
    const inputs = call.mock.calls as unknown as [string, { params: unknown; query: unknown }][];
    expect(inputs[0]![0]).toBe("teacher.questionnaire-export.get");
    expect(inputs[0]![1]).toEqual({ params: { id: ID }, query: {}, body: undefined });
    expect(inputs[1]![1].query).toEqual({ includeText: "true" });
  });
  it("reads an answer, and refuses one that is not this questionnaire's export", async () => {
    expect(await readExport(apiOf(ok(BODY)), ID, false)).toEqual({ kind: "ok", data: BODY });
    expect((await readExport(apiOf(ok({ ...BODY, questionnaireId: "22222222-2222-4222-8222-222222222222" })), ID, false)).kind).toBe("unavailable");
    expect((await readExport(apiOf(ok({ ...BODY, schema: "other" })), ID, false)).kind).toBe("unavailable");
  });
  it("tells too few (409), not found (404), denied (403), signed out and unavailable apart", async () => {
    expect((await readExport(apiOf(fail(409, "conflict")), ID, false)).kind).toBe("tooFew");
    expect((await readExport(apiOf(fail(404, "not_found")), ID, false)).kind).toBe("notFound");
    expect((await readExport(apiOf(fail(403, "forbidden")), ID, false)).kind).toBe("denied");
    expect((await readExport(apiOf(fail(401, "unauthorized")), ID, false)).kind).toBe("signedOut");
    expect((await readExport(apiOf(fail(503, "unavailable")), ID, false)).kind).toBe("unavailable");
    expect((await readExport(apiOf(fail(0, "client_rejected")), ID, false)).kind).toBe("unavailable");
  });
  it("a dropped connection is unavailable, never an empty export", async () => {
    const call = vi.fn(async () => { throw new Error("down"); }) as never;
    expect((await readExport(call, ID, false)).kind).toBe("unavailable");
  });
});

describe("readTitle", () => {
  it("reads the title and keeps the refusals apart", async () => {
    expect(await readTitle(apiOf(ok({ title: "Izmišljeno istraživanje" })), ID)).toEqual({ kind: "ok", title: "Izmišljeno istraživanje" });
    expect((await readTitle(apiOf(fail(404, "not_found")), ID)).kind).toBe("notFound");
    expect((await readTitle(apiOf(fail(401, "unauthorized")), ID)).kind).toBe("signedOut");
    expect((await readTitle(apiOf(fail(500, "unavailable")), ID)).kind).toBe("unavailable");
  });
});
