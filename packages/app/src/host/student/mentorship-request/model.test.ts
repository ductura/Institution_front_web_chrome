import { describe, expect, it } from "vitest";

import { FAKE_TEACHERS, fakeMentorshipServer } from "./fake-port";
import { approvedOf, canRetarget, sendRequest, withdrawRequest } from "./model";
import { mentorshipRequestText as t } from "./messages.hr";
import { readMentorCandidates, readMyMentorshipRequests, studentMentorshipCall } from "../../../../../../src/client/mentorship";
import { decideMentorshipRequest, readMentorshipRequests } from "../../../../../../src/client/mentorship-requests";
import { readMentoredWorks } from "../../../../../../src/components/teacher/mentored-works-read";
import { studentsOf } from "../../teacher/mentorships/model";

const NEW = { workType: "bachelor_thesis", teacherId: FAKE_TEACHERS[0].teacherId } as const;

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
    expect(open?.studentName).toBe("Iva Izmišljena");
    expect(studentsOf(await worksOf(server))).toEqual([]);

    expect(await decideMentorshipRequest(server.teacher, { requestId: open!.requestId, decision: "approve" }))
      .toEqual({ kind: "odluceno", requestId: open!.requestId, decision: "approve" });
    expect((await mine(server))[0]?.state).toBe("approved");
    expect(await theirs(server)).toEqual([]);
    expect(studentsOf(await worksOf(server)).map((s) => s.name)).toEqual(["Iva Izmišljena"]);
  });

  it("(2) a declined request shows as declined, and the reason never reaches the student", async () => {
    const server = fakeMentorshipServer();
    await sendRequest(server.student, NEW);
    const [open] = await theirs(server);
    await decideMentorshipRequest(server.teacher, { requestId: open!.requestId, decision: "decline", reason: "Izmišljeni razlog" });
    const [request] = await mine(server);
    expect(request?.state).toBe("declined");
    expect(JSON.stringify(request)).not.toContain("razlog");
    expect(server.reasonOf(open!.requestId)).toBe("Izmišljeni razlog");
    expect(studentsOf(await worksOf(server))).toEqual([]);
  });

  it("(3) a request is withdrawn before the decision, then cannot be decided or withdrawn again", async () => {
    const server = fakeMentorshipServer();
    await sendRequest(server.student, NEW);
    const [open] = await theirs(server);
    expect((await withdrawRequest(server.student, open!.requestId))?.note).toEqual({ tone: "status", text: t.withdrawn });
    expect((await mine(server))[0]?.state).toBe("withdrawn");
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
    expect((await mine(server))[0]?.state).toBe("approved");
  });

  it("(0) the student picks a teacher from the candidates and the request names that teacher", async () => {
    const server = fakeMentorshipServer();
    const read = await readMentorCandidates(server.student);
    expect(read).toEqual({ kind: "ready", candidates: FAKE_TEACHERS });
    await sendRequest(server.student, { ...NEW, teacherId: FAKE_TEACHERS[1].teacherId });
    expect((await mine(server))[0]).toMatchObject({ teacherId: FAKE_TEACHERS[1].teacherId, teacherName: { givenName: "Ana", familyName: "Izmišljena" } });
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
    expect(await readMentorCandidates(answer({ candidates: [{ teacherId: "x", name: null, department: null }] }))).toEqual({ kind: "nepoznato" });
    expect(await readMentorCandidates(answer({ candidates: [{ teacherId: FAKE_TEACHERS[0].teacherId, displayName: "y" }] }))).toEqual({ kind: "nepoznato" });
    expect(await readMentorCandidates(answer({ candidates: [{ teacherId: FAKE_TEACHERS[0].teacherId, name: null, department: null }] })))
      .toEqual({ kind: "ready", candidates: [{ teacherId: FAKE_TEACHERS[0].teacherId, name: null, department: null }] });
    expect(await readMentorCandidates(answer({ candidates: [] }))).toEqual({ kind: "ready", candidates: [] });
    expect(await readMentorCandidates(async () => ({ ok: false as const, status: 401, code: "session_expired" }))).toEqual({ kind: "session-expired" });
    expect(await readMentorCandidates(async () => ({ ok: false as const, status: 503, code: "x" }))).toEqual({ kind: "nepoznato" });
  });

  it("the default transport sends the four contract routes same-origin through createApi", async () => {
    const seen: string[] = [];
    const json = { headers: { "content-type": "application/json" } };
    const id = "00000000-0000-4000-8000-000000000001";
    const call = studentMentorshipCall({
      baseUrl: "http://localhost",
      fetchImpl: async (url, init) => {
        const path = new URL(String(url)).pathname;
        seen.push(`${init?.method} ${path}`);
        if (path.endsWith("/withdraw")) return new Response(JSON.stringify({ requestId: id, state: "withdrawn" }), json);
        if (path === "/api/v1/mentorship-requests") return new Response(JSON.stringify({ requestId: id, state: "requested" }), { status: 201, ...json });
        return new Response(JSON.stringify(path.endsWith("candidates") ? { candidates: [] } : { requests: [] }), json);
      },
    });
    expect(await readMyMentorshipRequests(call)).toEqual({ kind: "ready", requests: [] });
    expect(await readMentorCandidates(call)).toEqual({ kind: "ready", candidates: [] });
    expect(await sendRequest(call, NEW)).toEqual({ note: { tone: "status", text: t.sent }, refresh: true });
    expect(await withdrawRequest(call, id)).toEqual({ note: { tone: "status", text: t.withdrawn }, refresh: true });
    expect(seen).toEqual([
      "GET /api/v1/student/mentorship-requests", "GET /api/v1/student/mentor-candidates",
      "POST /api/v1/mentorship-requests", `POST /api/v1/mentorship-requests/${id}/withdraw`,
    ]);
    const html = studentMentorshipCall({ baseUrl: "http://localhost", fetchImpl: async () => new Response("<html>", { headers: { "content-type": "text/html" } }) });
    expect(await readMentorCandidates(html)).toEqual({ kind: "nepoznato" });
  });

  it("a second open request to the same teacher for the same work type is refused by the server and said so", async () => {
    const server = fakeMentorshipServer();
    await sendRequest(server.student, NEW);
    expect(await sendRequest(server.student, NEW)).toEqual({ note: { tone: "alert", text: t.alreadyOpen }, refresh: true });
    expect(await mine(server)).toHaveLength(1);
  });

  it("sends nothing without a teacher or for a work type the contract does not know", async () => {
    const calls: unknown[] = [];
    const call = async (...args: unknown[]) => { calls.push(args); return { ok: false as const, status: 500, code: "x" }; };
    expect((await sendRequest(call, { ...NEW, teacherId: "" }))?.note.text).toBe(t.invalid);
    expect((await sendRequest(call, { ...NEW, workType: "seminar_paper" as never }))?.note.text).toBe(t.invalid);
    expect(calls).toEqual([]);
  });

  it("a failed or odd answer is never a success", async () => {
    const down = async () => ({ ok: false as const, status: 503, code: "x" });
    expect((await sendRequest(down, NEW))?.note).toEqual({ tone: "alert", text: t.unknown });
    expect((await withdrawRequest(down, "00000000-0000-4000-8000-000000000001"))?.note).toEqual({ tone: "alert", text: t.unknown });
    const odd = async () => ({ ok: true as const, status: 201, body: { requestId: "x", state: "requested" } });
    expect((await sendRequest(odd, NEW))?.note.tone).toBe("alert");
    expect(await readMyMentorshipRequests(odd)).toEqual({ kind: "nepoznato" });
  });

  it("an ended session sends nothing to the page", async () => {
    const gone = async () => ({ ok: false as const, status: 401, code: "session_expired" });
    expect(await sendRequest(gone, NEW)).toBeNull();
    expect(await withdrawRequest(gone, "00000000-0000-4000-8000-000000000001")).toBeNull();
    expect(await readMyMentorshipRequests(gone)).toEqual({ kind: "session-expired" });
  });

  it("a decided request without an end, or an approved one without a mentorship, is a broken contract", async () => {
    const base = { requestId: "00000000-0000-4000-8000-000000000001", teacherId: FAKE_TEACHERS[0].teacherId, teacherName: { givenName: "Marko", familyName: "Izmišljeni" }, workType: "bachelor_thesis", requestedAt: "2026-11-21T10:00:00.000Z" };
    const end = "2026-11-21T11:00:00.000Z";
    const answer = (requests: unknown[]) => async () => ({ ok: true as const, status: 200, body: { requests } });
    expect(await readMyMentorshipRequests(answer([{ ...base, state: "declined", endedAt: null, mentorshipId: null }]))).toEqual({ kind: "nepoznato" });
    expect(await readMyMentorshipRequests(answer([{ ...base, state: "approved", endedAt: end, mentorshipId: null }]))).toEqual({ kind: "nepoznato" });
    expect(await readMyMentorshipRequests(answer([{ ...base, state: "requested", endedAt: null, mentorshipId: null }]))).toMatchObject({ kind: "ready" });
    expect(await readMyMentorshipRequests(answer([{ ...base, state: "declined", endedAt: end, mentorshipId: null }]))).toMatchObject({ kind: "ready" });
  });

  it("a declined request carries no reason in what the page reads", async () => {
    const server = fakeMentorshipServer();
    await sendRequest(server.student, NEW);
    const [open] = await theirs(server);
    await decideMentorshipRequest(server.teacher, { requestId: open!.requestId, decision: "decline", reason: "Izmišljeni razlog" });
    expect(JSON.stringify(await mine(server))).not.toContain("razlog");
  });
});

async function worksOf(server: ReturnType<typeof fakeMentorshipServer>) {
  const read = await readMentoredWorks(server.works);
  if (read.kind !== "ready") throw new Error("expected works");
  return read.works;
}

describe("WEB-NF6-ETAPE (MK-7): the student's mentorship and a declined request", () => {
  const row = (requestId: string, state: "requested" | "approved" | "declined" | "withdrawn", endedAt: string | null) => ({
    requestId, teacherId: FAKE_TEACHERS[0].teacherId, teacherName: { givenName: "Marko", familyName: "Izmišljeni" },
    workType: "bachelor_thesis" as const, state, requestedAt: "2026-11-01T10:00:00.000Z", endedAt,
    mentorshipId: state === "approved" ? `00000000-0000-4000-8000-0000000000${requestId}` : null,
  });
  it("lists only the approved requests, newest decision first", () => {
    const rows = [row("a1", "approved", "2026-11-02T10:00:00.000Z"), row("b2", "declined", "2026-11-05T10:00:00.000Z"),
      row("c3", "approved", "2026-11-09T10:00:00.000Z"), row("d4", "requested", null)];
    expect(approvedOf(rows).map((r) => r.requestId)).toEqual(["c3", "a1"]);
    expect(approvedOf([])).toEqual([]);
  });
  it("sends only a declined request to another teacher", () => {
    expect(canRetarget(row("b2", "declined", "2026-11-05T10:00:00.000Z"))).toBe(true);
    for (const state of ["requested", "approved", "withdrawn"] as const) expect(canRetarget(row("x", state, state === "requested" ? null : "2026-11-05T10:00:00.000Z"))).toBe(false);
  });
});
