import { RouteLoading } from "@ductura/ui";

import { messagesHr as t } from "@/lib/i18n/messages.hr";

// Shown while the enrollment page reads the session.
export default function EnrollLoading() {
  return <RouteLoading label={t.workspace.panelLoading} />;
}
