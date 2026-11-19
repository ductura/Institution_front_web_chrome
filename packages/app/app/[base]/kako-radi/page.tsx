import { PendingPage } from "../../../src/host/pages";

// WAITS FOR src/components/how-it-works: HowItWorks still imports the Ductus
// "@/lib/i18n/messages.hr". The page reads no data (Ductus DAN-431, J-02).
// Source: Ductus src/app/kako-radi/page.tsx, copied to src/app/kako-radi/.
/** "Kako Ductura radi", the same for every signed-in role. */
export default function Page() {
  return <PendingPage />;
}
