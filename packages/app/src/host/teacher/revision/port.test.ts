import { afterEach, describe, expect, it, vi } from "vitest";

import { LIVE_PORT } from "../../editor/work/review/review-model";
import { revisionPort } from "./port";

const answer = (status: number, body: object = {}) => ({ ok: status === 200, status, body });
const DOC = "doc-1";
const BODY = { instruction: "Dopuni uvod.", dueAt: "2026-12-01T22:59:00.000Z" };

const fetchWith = (status: number, body: object) => vi.stubGlobal("fetch", vi.fn(async () =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
afterEach(() => vi.unstubAllGlobals());

describe("the live ports carry the whole-work return", () => {
  it("has a return on the review port and on the revision port", () => {
    expect(LIVE_PORT.returnForRevision).not.toBeNull();
    expect(typeof revisionPort.create).toBe("function");
  });
  it("answers unavailable, not ok, when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await revisionPort.create(DOC, BODY)).toBe("unavailable");
    expect(await LIVE_PORT.returnForRevision!({ action: "return", documentId: DOC, instruction: BODY.instruction, dueAt: BODY.dueAt })).toBeNull();
  });
  it("ignores a stub that answers nothing known", async () => {
    fetchWith(500, answer(500));
    expect(await revisionPort.create(DOC, BODY)).toBe("unavailable");
  });
});
