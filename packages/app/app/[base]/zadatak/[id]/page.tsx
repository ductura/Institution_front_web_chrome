import { PendingPage } from "../../../../src/host/pages";

// TREBA API: the assignment notice read and institution.acknowledgment.post; src/client has no module for them yet (readNotice in src/components/student still reads the database).
// Source: Ductus src/app/zadatak/[id]/page.tsx, copied to src/app/zadatak/[id]/.
/** S3 the notice of an assignment. */
export default function Page() {
  return <PendingPage />;
}
