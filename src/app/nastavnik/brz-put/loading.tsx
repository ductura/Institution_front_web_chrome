import { RouteLoading } from "@ductura/ui";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

export default function FastPathLoading() {
  return <RouteLoading label={t.fastPath.loading} />;
}
