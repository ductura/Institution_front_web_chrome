import { messagesHr as t } from "../../lib/i18n/messages.hr";
import UiPreview from "./UiPreview";

// WEB-03: the development preview of @ductura/ui. A `.dev.tsx` page exists
// only on `next dev` (next.config.ts, pageExtensions); a build has no route.
export const metadata = { title: t.uiPreview.title };

export default function UiPreviewPage() {
  return <UiPreview />;
}
