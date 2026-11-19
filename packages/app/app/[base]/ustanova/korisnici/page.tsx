import { PendingPage } from "../../../../src/host/pages";

// TREBA API: a read of the teacher roles (Ductus readTeacherRoles) next to institution.role-confirmation.post and institution.role-revocation.post; the contract has no read for it.
// Source: Ductus src/app/ustanova/korisnici/page.tsx, copied to src/app/ustanova/korisnici/.
/** A-02 the administrator confirms and revokes the teacher role. */
export default function Page() {
  return <PendingPage />;
}
