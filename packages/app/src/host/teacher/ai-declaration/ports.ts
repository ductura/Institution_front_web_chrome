import { createApi, type ApiResult } from "../../../../../../src/client/api.ts";
import { createDeclarationPort, type DeclarationPort } from "../../../../../../src/client/declaration.ts";

type Call = ReturnType<typeof createApi>;

/**
 * A port that has nothing to read: every read says „unavailable”. Kept for tests and for a view
 * that has no server; the page never shows invented data in its place.
 */
export const unavailableDeclarationPort: DeclarationPort = {
  readStudent: async () => ({ kind: "unavailable" }),
  confirm: async () => ({ kind: "unavailable" }),
  readTeacher: async () => ({ kind: "unavailable" }),
};

/**
 * The teacher's port on N-07 (PIL-K-AI-PRILOZI): the work id names the work (teacher.work.get),
 * whose assignment and student name the declaration (teacher.declaration-second.get, declaration-v2).
 * Read only: the teacher never writes the student's declaration, so the student half is unavailable.
 * A route that fails says „unavailable” or „signedOut”, never an empty declaration.
 */
export function createTeacherDeclarationPort(call: Call = createApi()): DeclarationPort {
  return {
    readStudent: async () => ({ kind: "unavailable" }),
    confirm: async () => ({ kind: "unavailable" }),
    async readTeacher(documentId) {
      let work: ApiResult<"teacher.work.get">;
      try {
        work = await call("teacher.work.get", { params: { documentId }, query: undefined, body: undefined });
      } catch {
        return { kind: "unavailable" };
      }
      if (!work.ok) return { kind: work.status === 401 ? "signedOut" : "unavailable" };
      if (work.body.documentId !== documentId) return { kind: "unavailable" };
      const target = { assignmentId: work.body.assignmentId, studentId: work.body.studentId };
      return createDeclarationPort(call, { teacherTarget: (id) => (id === documentId ? target : null) }).readTeacher(documentId);
    },
  };
}
