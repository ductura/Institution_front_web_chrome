import { PendingPage } from "../../../../../src/host/pages";

// TREBA API: teacher.access.get and live.document.get; src/client has no module for the live view yet.
// Source: Ductus src/app/nastavnik/rad/[id]/page.tsx, copied to src/app/nastavnik/rad/[id]/.
/** "Rad uživo": the teacher's live view of a work. */
export default function Page() {
  return <PendingPage />;
}
