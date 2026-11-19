import { PendingPage } from "../../../../src/host/pages";

// TREBA API: a read of the faculty rule versions (Ductus readFacultyRules); the contract has no read for it.
// Source: Ductus src/app/ustanova/pravila/page.tsx, copied to src/app/ustanova/pravila/.
/** A-04 the faculty rule versions, read only. */
export default function Page() {
  return <PendingPage />;
}
