// The real port of the course aggregate (PIL-K-ZBIRNO): course.aggregate.get through createApi (src/client;
// the answer is checked against the contract there). The route gives the course's students by stage of
// their work; it takes the course id only, so the assignments the aggregate covers are decided before it is
// asked: teacher.courses.get lists them and institution.assignment.get gives each one's `isPractice`
// (P-D1). A course with practice assignments only never reaches the route (loadAggregate, model.ts).
// An answer whose numbers do not add up is "unavailable", never a guessed share.
import { createApi, goToSignIn, type ApiResult } from "../../../../../../src/client/api";
import { readAssignmentVersion } from "../../../../../../src/client/teacher-assignment";
import { appHref } from "../../../../../../src/components/shell/nav";
import { readTeacherCourses, type TeacherCoursesCall } from "../../../../../../src/components/teacher/teacher-courses-read";
import { readPractice, type ReadAssignment } from "../assignment-card/model";
import { aggregatePath, type AggregateRead, type CourseAggregatePort, type CourseAssignment } from "./model";

export type AggregateCall = ReturnType<typeof createApi>;

/** The 200 body of course.aggregate.get, as the generated contract types give it. */
type Wire = Extract<ApiResult<"course.aggregate.get">, { ok: true }>["body"];

/** The route's answer as the model's read; totals that contradict the stages are "unavailable". */
export function aggregateOfWire(body: Wire): AggregateRead {
  if (body.status === "suppressed") return { kind: "suppressed" };
  const { notStarted, inProgress, submitted } = body.stages;
  if (body.submitted !== submitted || body.started !== inProgress + submitted) return { kind: "unavailable" };
  return { kind: "ready", data: { students: notStarted + inProgress + submitted, counts: { submitted, inProgress, notStarted } } };
}

export function courseAggregatePort(client: () => AggregateCall = () => createApi()): CourseAggregatePort {
  return {
    async read(courseId): Promise<AggregateRead> {
      const answer = await client()("course.aggregate.get", { params: { id: courseId }, query: {}, body: undefined }).catch(() => null);
      if (answer === null) return { kind: "unavailable" };
      if (!answer.ok) return answer.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
      return aggregateOfWire(answer.body);
    },
  };
}

export type CourseAssignmentsRead =
  | { readonly kind: "ready"; readonly value: { readonly courseName: string; readonly assignments: readonly CourseAssignment[] } }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notTeacher" }
  | { readonly kind: "unavailable" };

/**
 * The course's assignments with their practice flag. A course the teacher does not hold reads "unavailable";
 * a flag that cannot be read counts as not practice (as the N-01 badge), since the route decides the rest.
 */
export async function readCourseAssignments(
  courseId: string, client: () => AggregateCall = () => createApi(), readAssignment?: ReadAssignment,
): Promise<CourseAssignmentsRead> {
  const call = client();
  const courses = await readTeacherCourses(call as unknown as TeacherCoursesCall);
  if (courses.kind !== "ready") return { kind: courses.kind };
  const course = courses.courses.find((c) => c.id === courseId);
  if (course === undefined) return { kind: "unavailable" };
  const ids = course.assignments.map((a) => a.id);
  const flags = await readPractice(ids, readAssignment ?? ((id) => readAssignmentVersion(id, call)));
  return {
    kind: "ready",
    value: { courseName: course.name, assignments: ids.map((assignmentId) => ({ assignmentId, isPractice: flags.get(assignmentId) === true })) },
  };
}

/** A signed-out read goes to AAI@EduHr sign-in and comes back to this course's aggregate. */
export function signInToAggregate(base: string, courseId: string, leave?: (href: string) => void): void {
  goToSignIn(appHref(base, aggregatePath(courseId)), leave);
}
