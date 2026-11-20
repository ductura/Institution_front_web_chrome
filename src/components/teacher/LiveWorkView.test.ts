import { describe, expect, it, vi } from "vitest";

import { readSessionMark } from "./LiveWorkView";

// WEB-34 3/3: the session mark of the teacher's live view (D-118). Invented tags only.
const ORIGIN = "https://ductura.test";
const TAG = "izmisljena-oznaka-sesije-0123456789";
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("readSessionMark", () => {
  it("reads sessionTag of the session route, with the cookie, and stamps the time of this read", async () => {
    const transport = vi.fn<typeof fetch>(async () => json(200, { role: "teacher", sessionTag: TAG }));
    expect(await readSessionMark(transport, ORIGIN, () => 42)).toEqual({ tag: TAG, at: 42 });
    const [url, init] = transport.mock.calls[0]!;
    expect(String(url)).toBe(`${ORIGIN}/api/v1/me`);
    expect(init).toMatchObject({ method: "GET", credentials: "include", redirect: "manual" });
  });

  it("needs no journalScope: a teacher's session has only the tag", async () => {
    expect(await readSessionMark(async () => json(200, { sessionTag: TAG }), ORIGIN, () => 1)).toEqual({ tag: TAG, at: 1 });
  });

  it.each([
    ["signed out", json(401, { error: "unauthenticated" })],
    ["unavailable", json(503, { error: "unavailable" })],
    ["no tag", json(200, { role: "teacher" })],
    ["a tag that is not one token", json(200, { sessionTag: "dva dijela" })],
    ["a tag that is too short", json(200, { sessionTag: "kratko" })],
    ["not JSON", new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })],
  ])("gives null for %s, never a guessed mark", async (_name, response) => {
    expect(await readSessionMark(async () => response, ORIGIN)).toBeNull();
  });

  it("gives null when the request fails", async () => {
    expect(await readSessionMark(async () => { throw new TypeError("offline"); }, ORIGIN)).toBeNull();
  });
});
