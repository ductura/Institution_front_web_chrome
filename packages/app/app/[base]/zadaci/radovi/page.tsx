import { PendingPage } from "../../../../src/host/pages";

// TREBA API: the student's works (Ductus app.student_workspace()); @ductura/contracts 2.8.0 has no read for it.
// Source: Ductus src/app/zadaci/radovi/page.tsx, copied to src/app/zadaci/radovi/.
/** S "Moji radovi". */
export default function Page() {
  return <PendingPage />;
}
