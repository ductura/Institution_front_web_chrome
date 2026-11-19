import { PendingPage } from "../../../src/host/pages";

// TREBA API: student.assignment-work.get with live.document.get/put and evidence.*; src/client has no module for the work editor yet.
// Source: Ductus src/app/rad/page.tsx, copied to src/app/rad/.
/** "Radni prostor": the work editor. */
export default function Page() {
  return <PendingPage />;
}
