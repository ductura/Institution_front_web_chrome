import { AssistantComingSoon } from "@ductura/ui";

import { assistantComingSoonHr as t } from "./messages.hr";

/** The assistant card while the assistant is off (C-13): static, no route, no request, no key field. */
export function AssistantComingSoonCard() {
  return <AssistantComingSoon labels={t} purposes={t.purposes} />;
}
