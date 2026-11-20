import type { Metadata } from "next";

import { publicVerificationHr } from "@/components/public-verification/messages.hr";
import { VerificationForm } from "@/components/public-verification/VerificationForm";
import { messagesHr } from "@/lib/i18n/messages.hr";

export const metadata: Metadata = {
  title: `${publicVerificationHr.title} · ${messagesHr.app.name}`,
  referrer: "no-referrer",
};

export default function PublicVerificationPage() {
  return <VerificationForm />;
}
