import ErrorScreen from "../../../src/components/shell/ErrorScreen.tsx";
import { messagesHr as t } from "../../../locales/hr.ts";

/** A path under /app outside /app/web/ and /app/chrome/. */
export default function NotFound() {
  return <ErrorScreen title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />;
}
