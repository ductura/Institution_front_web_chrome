import { describe, expect, it } from "vitest";

import { fakeMentorshipServer } from "./fake-port";
import { sendRequest, withdrawRequest } from "./model";
import { mentorshipRequestText as t } from "./messages.hr";
import { readMyMentorshipRequests } from "../../../../../../src/client/mentorship";
import { decideMentorshipRequest, readMentorshipRequests } from "../../../../../../src/client/mentorship-requests";
import { readMentoredWorks } from "../../../../../../src/components/teacher/mentored-works-read";
import { studentsOf } from "../../teacher/mentorships/model";

const TITLE = "Izmišljeni naslov završnog rada";
const NEW = { title: TITLE, workType: "bachelor_thesis" } as const;

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
    const base = { requestId: "00000000-0000-4000-8000-000000000001", title: TITLE, workType: "bachelor_thesis", requestedAt: "2026-11-21T10:00:00.000Z" };
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
