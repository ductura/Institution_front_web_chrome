// An in-memory institution server for the mentorship flow (WEB-1404), answering the
// transports of both sides with invented data. Tests only; it keeps the rules the
// plan gives the server: one open request per student and title, a decision only on a
// pending request, a withdrawal only before it, the decline reason kept and never returned
// to the student (P-6).
import type { StudentMentorshipCall, StudentMentorshipRequest } from "../../../../../../src/client/mentorship";
import type { MentorshipCall } from "../../../../../../src/client/mentorship-requests";
import type { MentoredWorksCall } from "../../../../../../src/components/teacher/mentored-works-read";

type Stored = { -readonly [K in keyof StudentMentorshipRequest]: StudentMentorshipRequest[K] } & { studentName: string; reason?: string };
const ok = (body: unknown, status = 200) => ({ ok: true as const, status, body });
const fail = (status: number, code: string) => ({ ok: false as const, status, code });

export function fakeMentorshipServer(studentName = "Iva Izmišljena") {
  const rows: Stored[] = [];
  let next = 1;
  const id = () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
  const publicView = ({ studentName: _n, reason: _r, ...request }: Stored): StudentMentorshipRequest => request;
  const find = (requestId: unknown) => rows.find((r) => r.requestId === requestId);
  const clock = () => "2026-11-21T10:00:00.000Z";

  const student: StudentMentorshipCall = async (call, input) => {
    const body = input.body as Record<string, string> | undefined;
    if (call === "student.mentorship-requests.get") return ok({ requests: rows.map(publicView) });
    if (call === "student.mentorship-request.post") {
      if (rows.some((r) => r.status === "pending" && r.title === body?.title)) return fail(409, "conflict");
      const row: Stored = {
        requestId: id(), title: body?.title ?? "", workType: body?.workType as Stored["workType"],
        status: "pending", requestedAt: clock(), decidedAt: null, studentName,
      };
      rows.push(row);
      return ok({ request: publicView(row) }, 201);
    }
    const row = find(body?.requestId);
    if (row === undefined) return fail(404, "not_found");
    if (row.status !== "pending") return fail(409, "conflict");
    row.status = "withdrawn";
    row.decidedAt = clock();
    return ok({ requestId: row.requestId, status: "withdrawn" });
  };

  const teacher: MentorshipCall = async (call, input) => {
    if (call === "teacher.mentorship-requests.get") {
      return ok({
        requests: rows.filter((r) => r.status === "pending").map((r) => ({
          requestId: r.requestId, studentName: r.studentName, title: r.title, workType: r.workType, requestedAt: r.requestedAt,
        })),
      });
    }
    const body = input.body as { requestId: string; decision: "approve" | "decline"; reason?: string };
    const row = find(body.requestId);
    if (row === undefined) return fail(404, "not_found");
    if (row.status !== "pending") return fail(409, "conflict");
    row.status = body.decision === "approve" ? "approved" : "declined";
    row.decidedAt = clock();
    if (body.reason !== undefined) row.reason = body.reason;
    return ok({ requestId: row.requestId, decision: body.decision });
  };

  const works: MentoredWorksCall = async () => ok({
    works: rows.filter((r) => r.status === "approved").map((r) => ({
      mentorshipId: r.requestId, assignmentId: r.requestId, documentId: null,
      student: { givenName: r.studentName.split(" ")[0] ?? "", familyName: r.studentName.split(" ").slice(1).join(" ") },
      title: r.title, workType: r.workType as "bachelor_thesis", workState: "not_started" as const,
    })),
  }) as never;

  return { student, teacher, works, reasonOf: (requestId: string) => find(requestId)?.reason };
}
