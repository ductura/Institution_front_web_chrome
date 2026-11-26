import type { Metadata } from "next";

import { messagesHr as t } from "../../../../../src/lib/i18n/messages.hr";
import LandingPage from "../../../src/host/public/LandingPage";

// DAN-1520: the public home page after the owner's concept, without signing in.
export const metadata: Metadata = { title: t.landing.header.home };

export default function Page() {
  return <LandingPage />;
}
