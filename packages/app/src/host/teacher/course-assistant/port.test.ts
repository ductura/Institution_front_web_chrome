import { describe, expect, it } from "vitest";

import { createApi } from "../../../../../../src/client/api";
import { courseAssistantPort } from "./port";

// F4-PM1-R07: the switch read and written through the real port, createApi over invented answers.
const COURSE = "00000000-0000-4000-8000-0000000000c1";
type Answer = { status: number; body?: unknown } | "lost";

function port(answer: Answer, seen: { method: string; url: string; body: string }[] = []) {
  return courseAssistantPort(() => createApi({
    baseUrl: "http://127.0.0.1:1",
    fetchImpl: async (input, init) => {
      const req = input instanceof Request ? input : new Request(String(input), init);
      seen.push({ method: req.method, url: req.url, body: await req.clone().text() });
      if (answer === "lost") throw new TypeError("network");
      return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status, headers: { "content-type": "application/json" } });
    },
  }));
}

describe("course assistant port", () => {
  it("reads the state of the switch from the route", async () => {
    const seen: { method: string; url: string; body: string }[] = [];
    expect(await port({ status: 200, body: { enabled: true } }, seen).read(COURSE)).toEqual({ kind: "ready", enabled: true });
    expect(seen[0]!.method).toBe("GET");
    expect(seen[0]!.url).toContain(`/teacher/courses/${COURSE}/assistant`);
  });

  it("a 404 is not found, a 401 signed out, a 503 or a lost answer unavailable; never an off switch", async () => {
    expect(await port({ status: 404, body: { error: "not_found" } }).read(COURSE)).toEqual({ kind: "notFound" });
    expect(await port({ status: 401, body: { error: "unauthorized" } }).read(COURSE)).toEqual({ kind: "signedOut" });
    expect(await port({ status: 503, body: { error: "unavailable" } }).read(COURSE)).toEqual({ kind: "unavailable" });
    expect(await port("lost").read(COURSE)).toEqual({ kind: "unavailable" });
  });

  it("an answer outside the contract is unavailable, not a state", async () => {
    expect(await port({ status: 200, body: { enabled: "yes" } }).read(COURSE)).toEqual({ kind: "unavailable" });
    expect(await port({ status: 200, body: {} }).read(COURSE)).toEqual({ kind: "unavailable" });
  });

  it("writes the switch and returns the state in force", async () => {
    const seen: { method: string; url: string; body: string }[] = [];
    expect(await port({ status: 200, body: { enabled: false } }, seen).write(COURSE, false)).toEqual({ kind: "done", enabled: false });
    expect(seen[0]!.method).toBe("PUT");
    expect(JSON.parse(seen[0]!.body)).toEqual({ enabled: false });
  });

  it("a write refused or lost says so: another course's is not found, a lost answer is unknown, never done", async () => {
    expect(await port({ status: 404, body: { error: "not_found" } }).write(COURSE, true)).toEqual({ kind: "notFound" });
    expect(await port({ status: 401, body: { error: "unauthorized" } }).write(COURSE, true)).toEqual({ kind: "signedOut" });
    expect(await port({ status: 422, body: { error: "invalid_input" } }).write(COURSE, true)).toEqual({ kind: "invalid" });
    expect(await port({ status: 503, body: { error: "unavailable" } }).write(COURSE, true)).toEqual({ kind: "unknown" });
    expect(await port("lost").write(COURSE, true)).toEqual({ kind: "unknown" });
  });

  it("a malformed course id never reaches the route as a write", async () => {
    const seen: { method: string; url: string; body: string }[] = [];
    expect((await port({ status: 200, body: { enabled: true } }, seen).write("not-a-uuid", true)).kind).toBe("invalid");
    expect(seen).toEqual([]);
  });
});
