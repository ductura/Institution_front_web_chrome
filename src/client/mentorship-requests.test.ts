// WEB-30 (N-16, B-6), LOK-WEB-5: mentorship requests for the teacher in the
// server's shape (openapi v1). All data is invented.
import { describe, expect, it } from "vitest";
import {
  decideMentorshipRequest, decisionSendable, readMentorshipRequests, REASON_MAX, type MentorshipCall,
} from "./mentorship-requests";

const REQUEST = "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c9d";
const OTHER = "3e9c4f5b-7d80-4b12-8d4e-5f6a7b8c9d0e";
// As the server sends it, and as the client gives it to the page.
const request = {
  requestId: REQUEST, student: { givenName: "Iva", familyName: "Izmišljena" },
  workType: "bachelor_thesis", requestedAt: "2026-11-10T08:00:00Z",
};
const shown = { requestId: REQUEST, studentName: "Iva Izmišljena", workType: "bachelor_thesis", requestedAt: "2026-11-10T08:00:00Z" };
const NO_INPUT = { params: undefined, query: undefined };

function answer(status: number, body: unknown, calls: Parameters<MentorshipCall>[] = []): MentorshipCall {
  return async (...call) => {
    calls.push(call);
    return status < 400 ? { ok: true, status, body } : { ok: false, status, code: "x" };
  };
}

const nepoznato = { kind: "nepoznato" };

describe("readMentorshipRequests", () => {
  it("one call; the student's two names become one, an unnamed one stays null; an empty list is empty", async () => {
    const calls: Parameters<MentorshipCall>[] = [];
    const nameless = { ...request, requestId: OTHER, student: null };
    expect(await readMentorshipRequests(answer(200, { requests: [request, nameless] }, calls)))
      .toEqual({ kind: "ready", requests: [shown, { ...shown, requestId: OTHER, studentName: null }] });
    expect(calls).toEqual([["teacher.mentorship-requests.get", NO_INPUT]]);
    expect(await readMentorshipRequests(answer(200, { requests: [] }))).toEqual({ kind: "ready", requests: [] });
  });

  it.each([
    ["an unknown field on the list", { requests: [], more: true }],
    ["an unknown field on a request", { requests: [{ ...request, email: "iva@example.invalid" }] }],
    ["an unknown work type", { requests: [{ ...request, workType: "short_paper" }] }],
    ["a seminar paper (not a server work type)", { requests: [{ ...request, workType: "seminar_paper" }] }],
    ["the old flat name with a title", { requests: [shown] }],
    ["a student without a family name", { requests: [{ ...request, student: { givenName: "Iva" } }] }],
    ["a time that is not a date", { requests: [{ ...request, requestedAt: "jučer" }] }],
    ["the same request twice", { requests: [request, request] }],
  ])("%s is nepoznato, never shown", async (_name, body) => {
    expect(await readMentorshipRequests(answer(200, body))).toEqual(nepoznato);
  });

  it("401 ends the session; other failures and a broken connection are nepoznato, never an empty list", async () => {
    expect(await readMentorshipRequests(answer(401, null))).toEqual({ kind: "session-expired" });
    for (const status of [403, 404, 408, 503]) expect(await readMentorshipRequests(answer(status, null))).toEqual(nepoznato);
    expect(await readMentorshipRequests(() => Promise.reject(new TypeError("Failed to fetch")))).toEqual(nepoznato);
  });
});

describe("decideMentorshipRequest (B-6)", () => {
  it("approve sends no reason; odluceno only from the server's answer", async () => {
    const calls: Parameters<MentorshipCall>[] = [];
    const outcome = await decideMentorshipRequest(answer(200, { decision: "approve", mentorshipId: OTHER }, calls), { requestId: REQUEST, decision: "approve" });
    expect(calls).toEqual([["teacher.mentorship-request-decision.post", { ...NO_INPUT, body: { requestId: REQUEST, decision: "approve" } }]]);
    expect(outcome).toEqual({ kind: "odluceno", requestId: REQUEST, decision: "approve" });
  });

  it("decline with and without a reason up to 600 characters", async () => {
    const calls: Parameters<MentorshipCall>[] = [];
    const ok = answer(200, { decision: "decline" }, calls);
    const reason = "r".repeat(REASON_MAX);
    expect(await decideMentorshipRequest(ok, { requestId: REQUEST, decision: "decline", reason }))
      .toEqual({ kind: "odluceno", requestId: REQUEST, decision: "decline" });
    expect(await decideMentorshipRequest(ok, { requestId: REQUEST, decision: "decline" }))
      .toEqual({ kind: "odluceno", requestId: REQUEST, decision: "decline" });
    expect(calls.map(([, input]) => input.body)).toEqual([
      { requestId: REQUEST, decision: "decline", reason }, { requestId: REQUEST, decision: "decline" },
    ]);
  });

  it.each([
    ["a reason with approve", { requestId: REQUEST, decision: "approve", reason: "razlog" }],
    ["a reason over 600 characters", { requestId: REQUEST, decision: "decline", reason: "r".repeat(REASON_MAX + 1) }],
    ["a blank reason", { requestId: REQUEST, decision: "decline", reason: "   " }],
    ["an empty reason", { requestId: REQUEST, decision: "decline", reason: "" }],
    ["a malformed id", { requestId: "nije-id", decision: "approve" }],
    ["an unknown decision", { requestId: REQUEST, decision: "defer" }],
  ])("%s is not sent", async (_name, input) => {
    const calls: Parameters<MentorshipCall>[] = [];
    const typed = input as Parameters<typeof decideMentorshipRequest>[1];
    expect(decisionSendable(typed)).toBe(false);
    expect(await decideMentorshipRequest(answer(200, {}, calls), typed)).toEqual({ kind: "greska", code: "invalid" });
    expect(calls).toEqual([]);
  });

  it.each([
    ["the other decision", { decision: "decline" }],
    ["an approval without a mentorship", { decision: "approve" }],
    ["a malformed mentorship id", { decision: "approve", mentorshipId: "nije-id" }],
    ["the old answer with the request id", { requestId: REQUEST, decision: "approve" }],
    ["an unknown field", { decision: "approve", mentorshipId: OTHER, more: true }],
    ["no body", null],
  ])("an answer naming %s is nepoznato, never a success", async (_name, body) => {
    expect(await decideMentorshipRequest(answer(200, body), { requestId: REQUEST, decision: "approve" })).toEqual(nepoznato);
  });

  it.each([
    [401, { kind: "session-expired" }],
    [404, nepoznato],
    [409, { kind: "vec-odluceno" }],
    [422, { kind: "greska", code: "invalid" }],
    [403, nepoznato],
    [408, nepoznato],
    [503, nepoznato],
    [201, nepoznato],
  ])("%i reads %o", async (status, expected) => {
    const body = { decision: "approve", mentorshipId: OTHER };
    expect(await decideMentorshipRequest(answer(status, body), { requestId: REQUEST, decision: "approve" })).toEqual(expected);
  });

  it("a broken connection (server off) is nepoznato: no success message", async () => {
    const off: MentorshipCall = () => Promise.reject(new TypeError("Failed to fetch"));
    expect(await decideMentorshipRequest(off, { requestId: REQUEST, decision: "approve" })).toEqual(nepoznato);
  });
});
