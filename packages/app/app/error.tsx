"use client";

import ErrorScreen from "../../../src/components/shell/ErrorScreen.tsx";
import { messagesHr as t } from "../../../locales/hr.ts";

// From Ductus src/app/error.tsx (#732 item 3): an unexpected error of a page.
// The error itself is not shown: its message is English and may carry
// internal detail.
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <title>{`${t.errorPage.errorTitle} · ${t.app.name}`}</title>
      <ErrorScreen title={t.errorPage.errorTitle} body={t.errorPage.errorBody} onRetry={reset} />
    </>
  );
}
