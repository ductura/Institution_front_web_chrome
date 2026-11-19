import { PendingPage } from "../../../../../src/host/pages";

// TREBA API: student.assignment-work.get and submission.submit.post; src/client has no module for them yet.
// Source: Ductus src/app/rad/[assignmentId]/predaja/page.tsx, copied to src/app/rad/[assignmentId]/predaja/.
/** "Predaja rada". */
export default function Page() {
  return <PendingPage />;
}
