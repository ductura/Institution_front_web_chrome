// An in-memory institution server for the mentorship flow (WEB-1404, WEB-2002), answering the
// transports of both sides with invented data. Tests only; it keeps the rules the
// plan gives the server: one open request per student, teacher and work type, a decision only on a
// pending request, a withdrawal only before it, the decline reason kept and never returned
// to the student (P-6).
import type { StudentMentorshipCall, StudentMentorshipRequest } from "../../../../../../src/client/mentorship";
import type { MentorshipCall } from "../../../../../../src/client/mentorship-requests";
import type { MentoredWorksCall } from "../../../../../../src/components/teacher/mentored-works-read";

// The teacher's side still shows a title (its routes are not in this task); the student's contract has none.
const FAKE_TITLE = "Izmišljeni naslov završnog rada";
type Stored = { -readonly [K in keyof StudentMentorshipRequest]: StudentMentorshipRequest[K] } & { studentName: string; title: string; reason?: string };
const ok = (body: unknown, status = 200) => ({ ok: true as const, status, body });
const fail = (status: number, code: string) => ({ ok: false as const, status, code });

export const FAKE_TEACHERS = [
  { teacherId: "10000000-0000-4000-8000-000000000001", name: { givenName: "Marko", familyName: "Izmišljeni" }, department: "Izmišljeni odsjek" },
  { teacherId: "10000000-0000-4000-8000-000000000002", name: { givenName: "Ana", familyName: "Izmišljena" }, department: null },
] as const;

export function fakeMentorshipServer(studentName = "Iva Izmišljena") {
  const rows: Stored[] = [];
  let next = 1;
  const id = () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
  const publicView = ({ studentName: _n, title: _t, reason: _r, ...request }: Stored): StudentMentorshipRequest => request;
  const find = (requestId: unknown) => rows.find((r) => r.requestId === requestId);
  const clock = () => "2026-11-21T10:00:00.000Z";

  const student: StudentMentorshipCall = async (call, input) => {
    const body = input.body as Record<string, string> | undefined;
    if (call === "mentorship.student-mentor-candidates.get") return ok({ candidates: FAKE_TEACHERS });
    if (call === "mentorship.student-requests.get") return ok({ requests: rows.map(publicView) });
    if (call === "mentorship.requests.post") {
      const teacher = FAKE_TEACHERS.find((c) => c.teacherId === body?.teacherId);
      if (teacher === undefined) return fail(404, "not_found");
      if (rows.some((r) => r.state === "requested" && r.teacherId === teacher.teacherId && r.workType === body?.workType)) return fail(409, "conflict");
      const row: Stored = {
        requestId: id(), title: FAKE_TITLE, workType: body?.workType as Stored["workType"],
        teacherId: teacher.teacherId, teacherName: teacher.name,
        state: "requested", requestedAt: clock(), endedAt: null, mentorshipId: null, studentName,
      };
      rows.push(row);
      return ok({ requestId: row.requestId, state: "requested" }, 201);
    }
    const row = find(input.params?.requestId);
    if (row === undefined) return fail(404, "not_found");
    if (row.state !== "requested") return fail(409, "conflict");
    row.state = "withdrawn";
    row.endedAt = clock();
    return ok({ requestId: row.requestId, state: "withdrawn" });
  };

  const teacher: MentorshipCall = async (call, input) => {
    if (call === "teacher.mentorship-requests.get") {
      return ok({
        requests: rows.filter((r) => r.state === "requested").map((r) => ({
          requestId: r.requestId, studentName: r.studentName, title: r.title, workType: r.workType, requestedAt: r.requestedAt,
        })),
      });
    }
    const body = input.body as { requestId: string; decision: "approve" | "decline"; reason?: string };
    const row = find(body.requestId);
    if (row === undefined) return fail(404, "not_found");
    if (row.state !== "requested") return fail(409, "conflict");
    row.state = body.decision === "approve" ? "approved" : "declined";
    row.endedAt = clock();
    row.mentorshipId = body.decision === "approve" ? row.requestId : null;
    if (body.reason !== undefined) row.reason = body.reason;
    return ok({ requestId: row.requestId, decision: body.decision });
  };

  const works: MentoredWorksCall = async () => ok({
    works: rows.filter((r) => r.state === "approved").map((r) => ({
      mentorshipId: r.requestId, assignmentId: r.requestId, documentId: null,
      student: { givenName: r.studentName.split(" ")[0] ?? "", familyName: r.studentName.split(" ").slice(1).join(" ") },
      title: r.title, workType: r.workType as "bachelor_thesis", workState: "not_started" as const,
    })),
  }) as never;

  return { student, teacher, works, reasonOf: (requestId: string) => find(requestId)?.reason };
}
