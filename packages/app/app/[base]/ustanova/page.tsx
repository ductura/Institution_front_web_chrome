import { PendingPage } from "../../../src/host/pages";

// TREBA API: a read of the institution overview (Ductus readInstitutionOverview); @ductura/contracts 2.8.0 has only POST routes under /api/v1/institution.
// Source: Ductus src/app/ustanova/page.tsx, copied to src/app/ustanova/.
/** A-01 the administrator's overview of their own institution. */
export default function Page() {
  return <PendingPage />;
}
