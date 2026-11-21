import { PendingPage } from "../../../../src/host/pages";

// TREBA API: teacher.access.get and teacher.fast-path.post; src/client has no module for them yet.
// Source: Ductus src/app/nastavnik/brz-put/page.tsx, copied to src/app/nastavnik/brz-put/.
/** "Brz put": the teacher's quick view of a submitted work. */
export default function Page() {
  return <PendingPage />;
}
