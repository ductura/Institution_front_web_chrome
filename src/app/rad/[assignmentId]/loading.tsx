import { RouteLoading } from "@ductura/ui";

import { messagesHr as t } from "../../../lib/i18n/messages.hr";

// WEB-23 (S: E-7, `ucitavanje`): shown while the page reads the assignment
// and the state of the work; a wait, never an empty sheet.
export default function WorkLoading() {
  return <RouteLoading label={t.workspace.statusLoading} />;
}
