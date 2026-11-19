import { PublicPendingPage } from "../../../src/host/pages";

// TREBA API: platform.status.get through src/client; StatusBoard in
// src/components/status still fetches the Ductus /api/status itself.
// Source: Ductus src/app/stanje/page.tsx, copied to src/app/stanje/.
/** "Stanje sustava", public: no session read (Ductus DAN-429). */
export default function Page() {
  return <PublicPendingPage />;
}
