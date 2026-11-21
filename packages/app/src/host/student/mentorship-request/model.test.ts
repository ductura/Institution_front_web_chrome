import { describe, expect, it } from "vitest";

import { FAKE_TEACHERS, fakeMentorshipServer } from "./fake-port";
import { sendRequest, withdrawRequest } from "./model";
import { mentorshipRequestText as t } from "./messages.hr";
import { mentorshipCall, readMentorCandidates, readMyMentorshipRequests } from "../../../../../../src/client/mentorship";
import { decideMentorshipRequest, readMentorshipRequests } from "../../../../../../src/client/mentorship-requests";
import { readMentoredWorks } from "../../../../../../src/components/teacher/mentored-works-read";
import { studentsOf } from "../../teacher/mentorships/model";

const TITLE = "Izmišljeni naslov završnog rada";
const NEW = { title: TITLE, workType: "bachelor_thesis", teacherId: FAKE_TEACHERS[0].teacherId } as const;

async function mine(server: ReturnType<typeof fakeMentorshipServer>) {
  const read = await readMyMentorshipRequests(server.student);
  if (read.kind !== "ready") throw new Error("expected a list");
  return read.requests;
}
async function theirs(server: ReturnType<typeof fakeMentorshipServer>) {
  const read = await readMentorshipRequests(server.teacher);
  if (read.kind !== "ready") throw new Error("expected a list");
  return read.requests;
}

describe("WEB-1404 mentorship flow over an invented server", () => {
  it("(1) request → approval → the student is in the teacher's list", async () => {
    const server = fakeMentorshipServer();
    expect((await sendRequest(server.student, NEW))?.note).toEqual({ tone: "status", text: t.sent });
    const [open] = await theirs(server);
    expect(open?.title).toBe(TITLE);
    expect(studentsOf(await worksOf(server))).toEqual([]);

    expect(await decideMentorshipRequest(server.teacher, { requestId: open!.requestId, decision: "approve" }))
      .toEqual({ kind: "odluceno", requestId: open!.requestId, decision: "approve" });
    expect((await mine(server))[0]?.status).toBe("approved");
    expect(await theirs(server)).toEqual([]);
    expect(studentsOf(await worksOf(server)).map((s) => s.name)).toEqual(["Iva Izmišljena"]);
  });

  it("(2) a declined request shows as declined, and the reason never reaches the student", async () => {
    const server = fakeMentorshipServer();
    await sendRequest(server.student, NEW);
    const [open] = await theirs(server);
    await decideMentorshipRequest(server.teacher, { requestId: open!.requestId, decision: "decline", reason: "Izmišljeni razlog" });
    const [request] = await mine(server);
    expect(request?.status).toBe("declined");
    expect(JSON.stringify(request)).not.toContain("razlog");
    expect(server.reasonOf(open!.requestId)).toBe("Izmišljeni razlog");
    expect(studentsOf(await worksOf(server))).toEqual([]);
  });

  it("(3) a request is withdrawn before the decision, then cannot be decided or withdrawn again", async () => {
    const server = fakeMentorshipServer();
    await sendRequest(server.student, NEW);
    const [open] = await theirs(server);
    expect((await withdrawRequest(server.student, open!.requestId))?.note).toEqual({ tone: "status", text: t.withdrawn });
    expect((await mine(server))[0]?.status).toBe("withdrawn");
    expect(await theirs(server)).toEqual([]);
    expect(await decideMentorshipRequest(server.teacher, { requestId: open!.requestId, decision: "approve" })).toEqual({ kind: "vec-odluceno" });
    expect((await withdrawRequest(server.student, open!.requestId))?.note.text).toBe(t.alreadyDecided);
  });

  it("a withdrawal after the teacher decided says so and reads the list again", async () => {
    const server = fakeMentorshipServer();
    await sendRequest(server.student, NEW);
    const [open] = await theirs(server);
    await decideMentorshipRequest(server.teacher, { requestId: open!.requestId, decision: "approve" });
    expect(await withdrawRequest(server.student, open!.requestId)).toEqual({ note: { tone: "alert", text: t.alreadyDecided }, refresh: true });
    expect((await mine(server))[0]?.status).toBe("approved");
  });

  it("(0) the student picks a teacher from the candidates and the request names that teacher", async () => {
    const server = fakeMentorshipServer();
    const read = await readMentorCandidates(server.student);
    expect(read).toEqual({ kind: "ready", candidates: FAKE_TEACHERS });
    await sendRequest(server.student, { ...NEW, teacherId: FAKE_TEACHERS[1].teacherId });
    expect((await mine(server))[0]).toMatchObject({ teacherId: FAKE_TEACHERS[1].teacherId, teacherName: "Ana Izmišljena" });
  });

  it("a teacher outside the candidates is refused, said so, and the list is read again; no teacher sends nothing", async () => {
    const server = fakeMentorshipServer();
    const stranger = "20000000-0000-4000-8000-000000000009";
    expect(await sendRequest(server.student, { ...NEW, teacherId: stranger })).toEqual({ note: { tone: "alert", text: t.teacherGone }, refresh: true });
    expect(await mine(server)).toEqual([]);
    expect((await sendRequest(server.student, { ...NEW, teacherId: "" }))?.note.text).toBe(t.invalid);
  });

  it("candidates: a broken answer or a repeated teacher is never a list; an ended session is its own", async () => {
    const answer = (body: unknown) => async () => ({ ok: true as const, status: 200, body });
    expect(await readMentorCandidates(answer({ candidates: [FAKE_TEACHERS[0], FAKE_TEACHERS[0]] }))).toEqual({ kind: "nepoznato" });
    expect(await readMentorCandidates(answer({ candidates: [{ teacherId: "x", displayName: "y" }] }))).toEqual({ kind: "nepoznato" });
    expect(await readMentorCandidates(answer({ candidates: [] }))).toEqual({ kind: "ready", candidates: [] });
    expect(await readMentorCandidates(async () => ({ ok: false as const, status: 401, code: "session_expired" }))).toEqual({ kind: "session-expired" });
    expect(await readMentorCandidates(async () => ({ ok: false as const, status: 503, code: "x" }))).toEqual({ kind: "nepoznato" });
  });

  it("the transport sends the four routes same-origin and never takes a non-JSON success", async () => {
    const seen: string[] = [];
    (globalThis as { location?: unknown }).location ??= { origin: "http://localhost" };
    const json = { headers: { "content-type": "application/json" } };
    const call = mentorshipCall(async (url, init) => {
      seen.push(`${init?.method} ${(url as URL).pathname}`);
      return new Response(JSON.stringify({ requests: [] }), json);
    });
    await call("student.mentorship-requests.get", {});
    await call("student.mentor-candidates.get", {});
    await call("student.mentorship-request.post", { body: {} });
    expect(seen).toEqual([
      "GET /api/v1/student/mentorship-requests", "GET /api/v1/student/mentor-candidates", "POST /api/v1/student/mentorship-requests",
    ]);
    expect(await mentorshipCall(async () => new Response("<html>", { headers: { "content-type": "text/html" } }))("student.mentor-candidates.get", {}))
      .toEqual({ ok: false, status: 0, code: "unexpected" });
    expect(await mentorshipCall(async () => new Response("{}", { status: 404, ...json }))("student.mentor-candidates.get", {}))
      .toMatchObject({ ok: false, status: 404 });
  });

  it("a second open request with the same title is refused by the server and said so", async () => {
    const server = fakeMentorshipServer();
    await sendRequest(server.student, NEW);
    expect(await sendRequest(server.student, NEW)).toEqual({ note: { tone: "alert", text: t.alreadyOpen }, refresh: true });
    expect(await mine(server)).toHaveLength(1);
  });

  it("sends nothing for a blank or over-long title", async () => {
    const calls: unknown[] = [];
    const call = async (...args: unknown[]) => { calls.push(args); return { ok: false as const, status: 500, code: "x" }; };
    expect((await sendRequest(call, { ...NEW, title: "   " }))?.note.text).toBe(t.invalid);
    expect((await sendRequest(call, { ...NEW, title: "x".repeat(257) }))?.note.text).toBe(t.invalid);
    expect(calls).toEqual([]);
  });

  it("a failed or odd answer is never a success", async () => {
    const down = async () => ({ ok: false as const, status: 503, code: "x" });
    expect((await sendRequest(down, NEW))?.note).toEqual({ tone: "alert", text: t.unknown });
    expect((await withdrawRequest(down, "00000000-0000-4000-8000-000000000001"))?.note).toEqual({ tone: "alert", text: t.unknown });
    const odd = async () => ({ ok: true as const, status: 200, body: { request: { requestId: "x" } } });
    expect((await sendRequest(odd, NEW))?.note.tone).toBe("alert");
    expect(await readMyMentorshipRequests(odd)).toEqual({ kind: "nepoznato" });
  });

  it("an ended session sends nothing to the page", async () => {
    const gone = async () => ({ ok: false as const, status: 401, code: "session_expired" });
    expect(await sendRequest(gone, NEW)).toBeNull();
    expect(await withdrawRequest(gone, "00000000-0000-4000-8000-000000000001")).toBeNull();
    expect(await readMyMentorshipRequests(gone)).toEqual({ kind: "session-expired" });
  });

  it("an answer carrying a reason, or a decided request without a time, is a broken contract", async () => {
    const base = { requestId: "00000000-0000-4000-8000-000000000001", title: TITLE, teacherId: FAKE_TEACHERS[0].teacherId, teacherName: "Marko Izmišljeni", workType: "bachelor_thesis", requestedAt: "2026-11-21T10:00:00.000Z" };
    const answer = (requests: unknown[]) => async () => ({ ok: true as const, status: 200, body: { requests } });
    expect(await readMyMentorshipRequests(answer([{ ...base, status: "declined", decidedAt: "2026-11-21T11:00:00.000Z", reason: "x" }]))).toEqual({ kind: "nepoznato" });
    expect(await readMyMentorshipRequests(answer([{ ...base, status: "declined", decidedAt: null }]))).toEqual({ kind: "nepoznato" });
    expect((await readMyMentorshipRequests(answer([{ ...base, status: "pending", decidedAt: null }]))).kind).toBe("ready");
  });
});

async function worksOf(server: ReturnType<typeof fakeMentorshipServer>) {
  const read = await readMentoredWorks(server.works);
  if (read.kind !== "ready") throw new Error("expected works");
  return read.works;
}
