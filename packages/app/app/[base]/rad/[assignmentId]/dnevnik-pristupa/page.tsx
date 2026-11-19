import { PendingPage } from "../../../../../src/host/pages";

// TREBA API: student.assignment-work.get and student.access-log.get; src/client has no module for them yet.
// Source: Ductus src/app/rad/[assignmentId]/dnevnik-pristupa/page.tsx, copied to src/app/rad/[assignmentId]/dnevnik-pristupa/.
/** "Dnevnik pristupa": who opened the student's work. */
export default function Page() {
  return <PendingPage />;
}
